"""Livability score: transit + amenity counts.

PRIMARY source: Overpass API (OpenStreetMap) — free, no API key, ToS-friendly.
FALLBACK source: Google Places — used only if LIVABILITY_PROVIDER=google AND
                  GOOGLE_PLACES_API_KEY is set.

Overpass etiquette:
  - public instance allows ~10k elements/day; we use ~1 req per condo.
  - rate-limited to ≥1.2s between calls (see OVERPASS_RATE_LIMIT_SEC).
  - timeouts honoured (default 25s).
"""
from __future__ import annotations

import asyncio
import math
import os

import httpx
from loguru import logger
from supabase import Client

from src.config import get_settings

# Endpoint is env-overridable so a bulk backfill can point at a higher-capacity
# mirror (e.g. OVERPASS_URL=https://overpass.kumi.systems/api/interpreter) when
# the default public instance is throttling. Default stays the canonical one.
OVERPASS_URL = os.environ.get(
    "OVERPASS_URL", "https://overpass-api.de/api/interpreter"
)
OVERPASS_TIMEOUT = 25
OVERPASS_RATE_LIMIT_SEC = 1.2

PLACES_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Overpass (default)
# ---------------------------------------------------------------------------

OVERPASS_QUERY = """
[out:json][timeout:{t}];
(
  node["amenity"="hospital"](around:1000,{lat},{lng});
  way["amenity"="hospital"](around:1000,{lat},{lng});
  node["amenity"="clinic"](around:1000,{lat},{lng});
  way["amenity"="clinic"](around:1000,{lat},{lng});

  node["amenity"="school"](around:1000,{lat},{lng});
  way["amenity"="school"](around:1000,{lat},{lng});
  node["amenity"="university"](around:1000,{lat},{lng});
  way["amenity"="university"](around:1000,{lat},{lng});

  node["shop"="supermarket"](around:1000,{lat},{lng});
  way["shop"="supermarket"](around:1000,{lat},{lng});

  node["railway"="station"](around:2000,{lat},{lng});
  node["public_transport"="station"](around:2000,{lat},{lng});
);
out center tags;
"""


def _is_bts(tags: dict) -> bool:
    blob = " ".join(
        str(v).lower() for v in (
            tags.get("name"), tags.get("name:en"),
            tags.get("operator"), tags.get("network"),
        ) if v
    )
    return "bts" in blob or "skytrain" in blob


def _is_mrt(tags: dict) -> bool:
    blob = " ".join(
        str(v).lower() for v in (
            tags.get("name"), tags.get("name:en"),
            tags.get("operator"), tags.get("network"), tags.get("station"),
        ) if v
    )
    return "mrt" in blob or "subway" in blob


async def _overpass_query(http: httpx.AsyncClient, lat: float, lng: float) -> dict:
    body = OVERPASS_QUERY.format(t=OVERPASS_TIMEOUT, lat=lat, lng=lng)
    # Overpass returns 406 unless we identify ourselves and accept JSON.
    headers = {
        "User-Agent": "RealData-bkk/1.0 (research; contact: chillanel22@gmail.com)",
        "Accept": "application/json",
    }
    r = await http.post(
        OVERPASS_URL,
        data={"data": body},
        headers=headers,
        timeout=OVERPASS_TIMEOUT + 5,
    )
    r.raise_for_status()
    return r.json()


def _summarise_overpass(payload: dict, lat: float, lng: float) -> dict:
    elements = payload.get("elements", [])
    hospitals = schools = supermarkets = 0
    bts: tuple[str | None, int | None] = (None, None)
    mrt: tuple[str | None, int | None] = (None, None)

    for el in elements:
        tags = el.get("tags") or {}
        amenity = tags.get("amenity")
        shop = tags.get("shop")
        railway = tags.get("railway")
        ptype = tags.get("public_transport")

        if amenity in ("hospital", "clinic"):
            hospitals += 1
        elif amenity in ("school", "university"):
            schools += 1
        elif shop == "supermarket":
            supermarkets += 1

        if railway == "station" or ptype == "station":
            elat = el.get("lat") or el.get("center", {}).get("lat")
            elng = el.get("lon") or el.get("center", {}).get("lon")
            if elat is None or elng is None:
                continue
            dist = int(_haversine_m(lat, lng, elat, elng))
            name = tags.get("name:en") or tags.get("name")
            if _is_bts(tags) and (bts[1] is None or dist < bts[1]):
                bts = (name, dist)
            if _is_mrt(tags) and (mrt[1] is None or dist < mrt[1]):
                mrt = (name, dist)

    return {
        "hospitals": hospitals,
        "schools": schools,
        "supermarkets": supermarkets,
        "bts_name": bts[0], "bts_m": bts[1],
        "mrt_name": mrt[0], "mrt_m": mrt[1],
    }


# ---------------------------------------------------------------------------
# Google Places (optional fallback — implemented for parity, used only when
# LIVABILITY_PROVIDER=google AND GOOGLE_PLACES_API_KEY is set)
# ---------------------------------------------------------------------------

async def _places_count(
    http: httpx.AsyncClient, key: str, lat: float, lng: float, kw: str, radius: int
) -> int:
    r = await http.get(PLACES_URL, params={
        "location": f"{lat},{lng}", "radius": radius, "keyword": kw, "key": key,
    })
    return len(r.json().get("results", [])) if r.status_code == 200 else 0


async def _places_nearest_station(
    http: httpx.AsyncClient, key: str, lat: float, lng: float, kind: str
) -> tuple[str | None, int | None]:
    r = await http.get(PLACES_URL, params={
        "location": f"{lat},{lng}", "rankby": "distance",
        "keyword": f"{kind} station", "key": key,
    })
    if r.status_code != 200:
        return None, None
    results = r.json().get("results", [])
    if not results:
        return None, None
    top = results[0]
    loc = top.get("geometry", {}).get("location", {})
    if "lat" not in loc:
        return top.get("name"), None
    return top.get("name"), int(_haversine_m(lat, lng, loc["lat"], loc["lng"]))


async def _gather_google(
    http: httpx.AsyncClient, key: str, lat: float, lng: float
) -> dict:
    bts_name, bts_m = await _places_nearest_station(http, key, lat, lng, "BTS")
    mrt_name, mrt_m = await _places_nearest_station(http, key, lat, lng, "MRT")
    return {
        "hospitals": await _places_count(http, key, lat, lng, "hospital", 1000),
        "schools": await _places_count(http, key, lat, lng, "school", 1000),
        "supermarkets": await _places_count(http, key, lat, lng, "supermarket", 1000),
        "bts_name": bts_name, "bts_m": bts_m,
        "mrt_name": mrt_name, "mrt_m": mrt_m,
    }


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _score(
    bts_m: int | None, mrt_m: int | None,
    hospitals: int, schools: int, supermarkets: int,
) -> float:
    transit = 0
    nearby = [d for d in (bts_m, mrt_m) if d is not None]
    closest = min(nearby) if nearby else None
    if closest is not None:
        if closest <= 300: transit = 40
        elif closest <= 500: transit = 32
        elif closest <= 800: transit = 24
        elif closest <= 1200: transit = 14
        else: transit = 6
    amenity = (
        min(20, hospitals * 4)
        + min(20, schools * 3)
        + min(20, supermarkets * 4)
    )
    return round(transit + amenity, 2)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def compute_livability(supabase: Client) -> int:
    s = get_settings()
    provider = os.environ.get("LIVABILITY_PROVIDER", "overpass").lower()
    use_google = provider == "google" and bool(s.google_places_api_key)

    rows = (
        supabase.table("condos")
        .select("id, latitude, longitude")
        .eq("is_active", True)
        .not_.is_("latitude", "null")
        .execute().data
    )
    if not rows:
        logger.info(
            "livability: no condos with lat/lng — extend scraper to capture coords"
        )
        return 0

    logger.info(
        f"livability: provider={'google' if use_google else 'overpass'}, "
        f"condos={len(rows)}"
    )

    written = 0
    async with httpx.AsyncClient(timeout=OVERPASS_TIMEOUT + 10) as http:
        for r in rows:
            cid, lat, lng = r["id"], r["latitude"], r["longitude"]
            try:
                if use_google:
                    summary = await _gather_google(
                        http, s.google_places_api_key, lat, lng
                    )
                else:
                    payload = await _overpass_query(http, lat, lng)
                    summary = _summarise_overpass(payload, lat, lng)
                supabase.table("livability_metrics").upsert({
                    "condo_id": cid,
                    "nearest_bts_distance_m": summary["bts_m"],
                    "nearest_bts_station": summary["bts_name"],
                    "nearest_mrt_distance_m": summary["mrt_m"],
                    "nearest_mrt_station": summary["mrt_name"],
                    "hospitals_within_1km": summary["hospitals"],
                    "schools_within_1km": summary["schools"],
                    "supermarkets_within_1km": summary["supermarkets"],
                    "livability_score": _score(
                        summary["bts_m"], summary["mrt_m"],
                        summary["hospitals"], summary["schools"],
                        summary["supermarkets"],
                    ),
                }, on_conflict="condo_id").execute()
                written += 1
            except Exception as e:
                logger.warning(f"livability failed for {cid}: {e}")
            if not use_google:
                await asyncio.sleep(OVERPASS_RATE_LIMIT_SEC)

    logger.info(f"livability: computed for {written}/{len(rows)} condos")
    return written
