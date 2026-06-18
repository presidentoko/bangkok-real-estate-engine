"""
Compute livability_metrics for condos that don't have them yet.

Strategy:
  1. Fetch condos with lat/lng but no livability_metrics entry.
  2. Group by province → compute a bounding box per province.
  3. One Overpass API call per province to pull all hospitals,
     supermarkets, schools, and (Bangkok only) BTS/MRT stations.
  4. For each condo: count POIs within 1 km, find nearest transit.
  5. Upsert livability_metrics.

Overpass API: https://overpass-api.de  (free, no auth needed)
Rate limit: max ~1 heavy query per second, be polite.

Usage:
  python scripts/fetch_livability_metrics.py                 # all missing
  python scripts/fetch_livability_metrics.py --province chiang-mai
  python scripts/fetch_livability_metrics.py --province bangkok --limit 100
"""
from __future__ import annotations

import argparse
import math
import os
import sys
import time
from collections import defaultdict
from typing import Optional

import requests
from dotenv import load_dotenv
from loguru import logger
from supabase import create_client

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, "web", ".env.local"))
load_dotenv(os.path.join(ROOT, ".env"))

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
RADIUS_M = 1000  # POI search radius

# Bangkok provinces (BTS/MRT only exist here)
BANGKOK_PROVINCES = {"bangkok"}


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def bbox_for_condos(condos: list[dict], pad_deg: float = 0.02) -> tuple[float, float, float, float]:
    lats = [c["latitude"] for c in condos]
    lngs = [c["longitude"] for c in condos]
    return (
        min(lats) - pad_deg,
        min(lngs) - pad_deg,
        max(lats) + pad_deg,
        max(lngs) + pad_deg,
    )


# ---------------------------------------------------------------------------
# Overpass queries
# ---------------------------------------------------------------------------

def overpass_query(query: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            r = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={
                    "User-Agent": "BangkokRealEstateEngine/1.0 (research; contact: chillanel22@gmail.com)",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout=60,
            )
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            if attempt < retries - 1:
                wait = 2 ** attempt * 5
                logger.warning(f"Overpass error ({exc}), retry in {wait}s")
                time.sleep(wait)
            else:
                raise


def fetch_pois_for_bbox(
    s: float, w: float, n: float, e: float, include_transit: bool = False
) -> dict[str, list[tuple[float, float, str]]]:
    """
    Returns dict of POI category → list of (lat, lng, name).
    Categories: hospitals, supermarkets, schools, bts_stations, mrt_stations.
    """
    bbox = f"{s},{w},{n},{e}"
    transit_block = ""
    if include_transit:
        transit_block = f"""
  node["network"="Bangkok Mass Transit System"](around:5000,{(s+n)/2},{(w+e)/2});
  node["network"="BTS"](around:5000,{(s+n)/2},{(w+e)/2});
  node["operator"="BTS"](around:5000,{(s+n)/2},{(w+e)/2});
  node["network"="MRT"](around:5000,{(s+n)/2},{(w+e)/2});
  node["operator"="MRTA"](around:5000,{(s+n)/2},{(w+e)/2});
"""

    query = f"""
[out:json][timeout:60];
(
  nwr["amenity"="hospital"]({bbox});
  nwr["amenity"="clinic"]({bbox});
  nwr["shop"="supermarket"]({bbox});
  nwr["shop"="convenience"]({bbox});
  nwr["amenity"="school"]({bbox});
  {transit_block}
);
out center;
"""
    data = overpass_query(query)

    hospitals: list[tuple[float, float, str]] = []
    supermarkets: list[tuple[float, float, str]] = []
    schools: list[tuple[float, float, str]] = []
    transit: list[tuple[float, float, str]] = []

    for el in data.get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        tags = el.get("tags", {})
        name = tags.get("name:en") or tags.get("name") or ""
        amenity = tags.get("amenity", "")
        shop = tags.get("shop", "")
        network = tags.get("network", "") + tags.get("operator", "")

        if amenity in ("hospital", "clinic"):
            hospitals.append((lat, lng, name))
        elif shop in ("supermarket", "convenience"):
            supermarkets.append((lat, lng, name))
        elif amenity == "school":
            schools.append((lat, lng, name))
        elif include_transit and ("BTS" in network or "MRT" in network or "MRTA" in network):
            transit.append((lat, lng, name))

    return {
        "hospitals": hospitals,
        "supermarkets": supermarkets,
        "schools": schools,
        "transit": transit,
    }


# ---------------------------------------------------------------------------
# BTS/MRT station list fallback (hardcoded Bangkok stations for accuracy)
# Lat/lng from Wikipedia / Google Maps
# ---------------------------------------------------------------------------

BTS_STATIONS: list[tuple[float, float, str]] = [
    # Sukhumvit line (partial)
    (13.7455, 100.5600, "Mo Chit"), (13.7400, 100.5596, "Saphan Khwai"),
    (13.7337, 100.5598, "Victory Monument"), (13.7296, 100.5599, "Phaya Thai"),
    (13.7270, 100.5602, "Ratchathewi"), (13.7440, 100.5327, "Chatuchak Park"),
    (13.7428, 100.5413, "Kamphaeng Phet"), (13.7395, 100.5497, "Saphan Khwai"),
    (13.7261, 100.5532, "Chit Lom"), (13.7237, 100.5500, "Ratchadamri"),
    (13.7208, 100.5403, "Sala Daeng"), (13.7248, 100.5578, "Siam"),
    (13.7216, 100.5668, "Asok"), (13.7181, 100.5731, "Phrom Phong"),
    (13.7157, 100.5810, "Thong Lo"), (13.7128, 100.5863, "Ekkamai"),
    (13.7104, 100.5941, "Phra Khanong"), (13.7053, 100.6018, "On Nut"),
    (13.6932, 100.6105, "Bang Chak"), (13.6820, 100.6140, "Punnawithi"),
    (13.6743, 100.6046, "Udom Suk"), (13.6659, 100.5979, "Bang Na"),
    (13.6529, 100.6049, "Bearing"), (13.6403, 100.6123, "Samrong"),
    (13.7285, 100.5200, "National Stadium"), (13.7165, 100.5302, "Surasak"),
    (13.7127, 100.5220, "Saphan Taksin"), (13.7212, 100.5136, "Krung Thon Buri"),
    (13.7265, 100.5011, "Wongwian Yai"),
    # Silom line extension (partial)
    (13.7178, 100.5283, "Chong Nonsi"),
    (13.7192, 100.5363, "St. Louis"), (13.7210, 100.5443, "Sala Daeng"),
]

MRT_STATIONS: list[tuple[float, float, str]] = [
    (13.7455, 100.5353, "Chatuchak Park"), (13.7564, 100.5349, "Phahon Yothin"),
    (13.7659, 100.5378, "Lat Phrao"), (13.7704, 100.5471, "Ratchadaphisek"),
    (13.7640, 100.5598, "Sutthisan"), (13.7583, 100.5657, "Huai Khwang"),
    (13.7510, 100.5670, "Thailand Cultural Centre"), (13.7440, 100.5659, "Phra Ram 9"),
    (13.7400, 100.5600, "Phetchaburi"), (13.7350, 100.5594, "Asok"),
    (13.7298, 100.5596, "Sukhumvit"), (13.7233, 100.5597, "Queen Sirikit"),
    (13.7218, 100.5504, "Lumphini"), (13.7178, 100.5427, "Silom"),
    (13.7398, 100.5179, "Bang Sue"), (13.7300, 100.5179, "Kamphaeng Phet"),
    (13.7196, 100.5179, "Lat Phrao"), (13.7250, 100.5100, "Hua Lamphong"),
    (13.7380, 100.5280, "Sam Yan"), (13.7290, 100.5350, "Phaya Thai"),
    (13.7250, 100.5250, "Si Lom"),
]


def nearest_station(
    lat: float, lng: float, stations: list[tuple[float, float, str]]
) -> tuple[float, str] | tuple[None, None]:
    if not stations:
        return None, None
    best_d = float("inf")
    best_name = ""
    for slat, slng, name in stations:
        d = haversine_m(lat, lng, slat, slng)
        if d < best_d:
            best_d = d
            best_name = name
    return best_d, best_name


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process_province(
    sb,
    province: str,
    condos: list[dict],
    dry_run: bool = False,
) -> tuple[int, int]:
    """Returns (updated, skipped)."""
    logger.info(f"[{province}] {len(condos)} condos to process")

    s, w, n, e = bbox_for_condos(condos)
    is_bkk = province in BANGKOK_PROVINCES

    logger.info(f"[{province}] Querying Overpass bbox ({s:.4f},{w:.4f},{n:.4f},{e:.4f}) transit={is_bkk}")
    pois = fetch_pois_for_bbox(s, w, n, e, include_transit=is_bkk)
    logger.info(
        f"[{province}] OSM: {len(pois['hospitals'])} hospitals, "
        f"{len(pois['supermarkets'])} supermarkets, "
        f"{len(pois['schools'])} schools, "
        f"{len(pois['transit'])} transit nodes"
    )
    time.sleep(2)  # be polite to Overpass

    updated = 0
    skipped = 0

    for condo in condos:
        lat, lng = condo["latitude"], condo["longitude"]
        cid = condo["id"]

        hosp_nearby = sum(
            1 for (plat, plng, _) in pois["hospitals"]
            if haversine_m(lat, lng, plat, plng) <= RADIUS_M
        )
        super_nearby = sum(
            1 for (plat, plng, _) in pois["supermarkets"]
            if haversine_m(lat, lng, plat, plng) <= RADIUS_M
        )
        school_nearby = sum(
            1 for (plat, plng, _) in pois["schools"]
            if haversine_m(lat, lng, plat, plng) <= RADIUS_M
        )

        if is_bkk:
            # Use OSM transit if found, else fall back to hardcoded lists
            transit_nodes = pois["transit"] or [(lat, lng, "") for lat, lng, _ in BTS_STATIONS]
            bts_d, bts_name = nearest_station(lat, lng, BTS_STATIONS)
            mrt_d, mrt_name = nearest_station(lat, lng, MRT_STATIONS)
        else:
            bts_d, bts_name = None, None
            mrt_d, mrt_name = None, None

        row = {
            "condo_id": cid,
            "hospitals_within_1km": hosp_nearby,
            "supermarkets_within_1km": super_nearby,
            "schools_within_1km": school_nearby,
            "nearest_bts_distance_m": round(bts_d) if bts_d is not None else None,
            "nearest_bts_station": bts_name or None,
            "nearest_mrt_distance_m": round(mrt_d) if mrt_d is not None else None,
            "nearest_mrt_station": mrt_name or None,
            "computed_at": "now()",
        }

        if dry_run:
            logger.info(f"  DRY {condo.get('name','?')}: hosp={hosp_nearby} super={super_nearby} bts={bts_d}")
            updated += 1
            continue

        try:
            sb.table("livability_metrics").upsert(row, on_conflict="condo_id").execute()
            updated += 1
        except Exception as exc:
            logger.error(f"  [{cid}] upsert failed: {exc}")
            skipped += 1

    return updated, skipped


def run(args: argparse.Namespace) -> None:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all condos with lat/lng
    logger.info("Fetching condos with lat/lng...")
    PAGE = 1000
    all_condos: list[dict] = []
    offset = 0
    while True:
        batch = (
            sb.table("condos")
            .select("id, name, latitude, longitude, province")
            .not_.is_("latitude", "null")
            .not_.is_("longitude", "null")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data or []
        )
        all_condos.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE
    logger.info(f"Total condos with lat/lng: {len(all_condos)}")

    # Fetch existing livability_metrics IDs (to skip)
    logger.info("Fetching existing livability_metrics coverage...")
    existing: set[str] = set()
    offset = 0
    while True:
        batch = sb.table("livability_metrics").select("condo_id").range(offset, offset + PAGE - 1).execute().data or []
        for r in batch:
            existing.add(r["condo_id"])
        if len(batch) < PAGE:
            break
        offset += PAGE
    logger.info(f"Already have metrics for {len(existing)} condos")

    # Filter
    missing = [c for c in all_condos if c["id"] not in existing]
    if args.province:
        # Accept both "chiang-mai" and "chiangmai" etc.
        prov_filter = args.province.lower()
        prov_alt = prov_filter.replace("-", "")  # e.g. "chiang-mai" → "chiangmai"
        missing = [
            c for c in missing
            if (c.get("province") or "").lower() in {prov_filter, prov_alt}
        ]
    if args.limit:
        missing = missing[: args.limit]

    logger.info(f"Condos to process: {len(missing)}")
    if not missing:
        logger.info("Nothing to do.")
        return

    # Group by province
    by_province: dict[str, list[dict]] = defaultdict(list)
    for c in missing:
        prov = (c.get("province") or "unknown").lower()
        by_province[prov].append(c)

    total_updated = 0
    total_skipped = 0
    for province, condos in sorted(by_province.items(), key=lambda x: -len(x[1])):
        u, s = process_province(sb, province, condos, dry_run=args.dry_run)
        total_updated += u
        total_skipped += s
        logger.info(f"[{province}] done: updated={u} skipped={s}")

    logger.info(f"All done. updated={total_updated} skipped={total_skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch OSM livability metrics for condos")
    parser.add_argument("--province", help="Only process this province slug (e.g. chiang-mai)")
    parser.add_argument("--limit", type=int, help="Max condos to process (for testing)")
    parser.add_argument("--dry-run", action="store_true", help="Query OSM but don't write to DB")
    run(parser.parse_args())
