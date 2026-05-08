"""Fetch Bangkok district (khet) polygons from OSM via Overpass → GeoJSON.

Run once (or whenever boundaries change):
    pip install requests osm2geojson
    python scripts/fetch_district_geojson.py

Output: web/public/bangkok-districts.geojson
        — each Feature has properties.name + properties.flood_risk_level
        — flood levels are joined from src/data/flood_districts.py at fetch time
"""
from __future__ import annotations

import io
import json
import os
import sys

# Allow `from src.*` imports when run from project root or scripts/.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests  # noqa: E402
import osm2geojson  # noqa: E402

from src.data.flood_districts import FLOOD_RISK_BY_DISTRICT  # noqa: E402
from src.util.district import DISTRICT_ALIASES  # noqa: E402

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
QUERY = """
[out:json][timeout:180];
area["name:en"="Bangkok"]["admin_level"="4"]->.bkk;
relation["admin_level"="6"]["boundary"="administrative"](area.bkk);
out body geom;
"""
# Bangkok admin levels in OSM:
#   4 = Bangkok province; 6 = khet (50 districts); 8 = khwaeng (~180 subdistricts).
# We want khet → admin_level=6.
OUT_PATH = os.path.join(ROOT, "web", "public", "bangkok-districts.geojson")


def _canonical_name(raw: str | None) -> str | None:
    """Normalise OSM 'name:en' → key in FLOOD_RISK_BY_DISTRICT."""
    if not raw:
        return None
    raw_clean = raw.strip()
    if raw_clean in FLOOD_RISK_BY_DISTRICT:
        return raw_clean
    # alias lookup (case-insensitive)
    for alias, canonical in DISTRICT_ALIASES.items():
        if alias.lower() == raw_clean.lower():
            return canonical
    # try removing common prefixes/suffixes
    stripped = raw_clean.replace(" District", "").replace("Khet ", "").strip()
    if stripped in FLOOD_RISK_BY_DISTRICT:
        return stripped
    return None


def main() -> None:
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    print("Querying Overpass for Bangkok districts (30–90s)…")
    # Overpass 2025+ returns 406 for requests with no/bad User-Agent. Always set one.
    headers = {
        "User-Agent": (
            "bangkok-real-estate-engine/0.1 "
            "(github: chillanel22; contact: chillanel22@gmail.com)"
        ),
        "Accept": "application/json",
    }
    r = requests.post(
        OVERPASS_URL, data={"data": QUERY}, headers=headers, timeout=200
    )
    r.raise_for_status()
    raw = r.json()
    print(f"  got {len(raw.get('elements', []))} elements")

    print("Converting OSM → GeoJSON…")
    fc = osm2geojson.json2geojson(raw)

    matched = unmatched = 0
    cleaned: list[dict] = []
    for feat in fc.get("features", []):
        props = feat.get("properties") or {}
        tags = props.get("tags") or props
        name_en = tags.get("name:en") or tags.get("name")
        canonical = _canonical_name(name_en)
        flood = FLOOD_RISK_BY_DISTRICT.get(canonical) if canonical else None
        if flood is not None:
            matched += 1
        else:
            unmatched += 1
            print(f"  ⚠ no flood data for OSM name: {name_en!r}")

        feat["properties"] = {
            "name": canonical or name_en,
            "name_osm": name_en,
            "name_th": tags.get("name:th") or tags.get("name"),
            "admin_level": tags.get("admin_level"),
            "flood_risk_level": flood,
        }
        cleaned.append(feat)

    fc["features"] = cleaned
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    print(
        f"✅ wrote {OUT_PATH}\n"
        f"   {len(cleaned)} districts ({matched} flood-matched, {unmatched} unmatched)"
    )


if __name__ == "__main__":
    main()
