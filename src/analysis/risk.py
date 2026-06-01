"""Risk: monsoon flood (district lookup) + construction (district news signal).

Design choices (per project requirements):
  - Flood: static district→risk dict in src/data/flood_districts.py, derived
    from public BMA / JICA / 2011-flood references. No real-time API call.
    A BMA GIS endpoint hook is preserved in `_flood_level_geojson()` for
    future drop-in upgrade — see below.
  - Construction: Google News RSS keyword frequency at district level
    (src/analysis/construction.py). Cached in-process so we hit RSS at most
    ~10 times per pipeline run, not once per condo.

Penalty model (subtracted from livability before percentile ranking):
  flood_penalty       = flood_level * 4         # 0..20
  construction_penalty= bucket_to_score[bucket] # 0, 6, or 12
  risk_penalty        = flood_penalty + construction_penalty
"""
from __future__ import annotations

from loguru import logger
from supabase import Client

from src.analysis.construction import district_construction_signal
from src.data.flood_districts import get_flood_level
from src.data.subsidence_districts import get_subsidence_level
from src.util.district import extract_district


# ---------------------------------------------------------------------------
# Future BMA GIS hook
# ---------------------------------------------------------------------------
# When BMA opens a public flood-polygon GeoJSON / JSON endpoint, replace the
# stub below. Expected request/response contract (illustrative):
#
#   GET https://gis.bma.go.th/api/v1/flood-risk?lat=13.745&lng=100.534
#   200 OK
#   {
#       "lat": 13.745, "lng": 100.534,
#       "risk_level": 3,                # 0..5
#       "zone_name": "Khlong San",
#       "data_year": 2024,
#       "source": "BMA Drainage Dept."
#   }
#
# Implementation sketch (keep async to match pipeline):
#
#   async def _flood_level_geojson(lat: float, lng: float) -> int | None:
#       async with httpx.AsyncClient(timeout=10) as http:
#           r = await http.get(
#               "https://gis.bma.go.th/api/v1/flood-risk",
#               params={"lat": lat, "lng": lng},
#           )
#           if r.status_code != 200: return None
#           return r.json().get("risk_level")
#
# For now we return None so the district-static lookup is authoritative.
def _flood_level_geojson(lat: float, lng: float) -> int | None:
    return None
# ---------------------------------------------------------------------------


_BUCKET_TO_PENALTY = {"low": 0, "medium": 6, "high": 12}
_BUCKET_TO_COUNT = {"low": 0, "medium": 1, "high": 3}  # informational only


def _penalty(flood_level: int | None, bucket: str) -> float:
    p = 0.0
    if flood_level is not None:
        p += flood_level * 4
    p += _BUCKET_TO_PENALTY.get(bucket, 0)
    return round(p, 2)


def compute_risk(supabase: Client) -> int:
    """Synchronous — hits RSS via feedparser (no event loop required)."""
    rows = (
        supabase.table("condos")
        .select("id, latitude, longitude, address, region_id")
        .eq("is_active", True)
        .execute().data
    )
    if not rows:
        logger.info("risk: no active condos")
        return 0

    region_rows = supabase.table("regions").select("id, name").execute().data
    region_name = {r["id"]: r["name"] for r in region_rows}

    construction_cache: dict[str, tuple[str, int]] = {}
    written = 0

    for r in rows:
        district_text = " ".join(filter(None, [
            r.get("address"),
            region_name.get(r.get("region_id")),
        ]))
        district = extract_district(district_text)

        # ----- Flood -----
        flood_level: int | None = None
        flood_source: str | None = None
        if r.get("latitude") and r.get("longitude"):
            flood_level = _flood_level_geojson(r["latitude"], r["longitude"])
            if flood_level is not None:
                flood_source = "bma_geojson"
        if flood_level is None and district:
            flood_level = get_flood_level(district)
            if flood_level is not None:
                flood_source = "district_static"

        # ----- Subsidence (land sinking — district-level, see src/data) -----
        subsidence_level = get_subsidence_level(district) if district else None
        subsidence_source = "district_static" if subsidence_level is not None else None

        # ----- Construction -----
        bucket = "low"
        hits = 0
        if district:
            if district not in construction_cache:
                construction_cache[district] = district_construction_signal(district)
            bucket, hits = construction_cache[district]

        supabase.table("risk_factors").upsert({
            "condo_id": r["id"],
            "flood_risk_level": flood_level,
            "flood_risk_source": flood_source,
            "subsidence_level": subsidence_level,
            "subsidence_source": subsidence_source,
            "active_construction_within_500m": bucket in ("medium", "high"),
            "construction_count": _BUCKET_TO_COUNT.get(bucket, 0),
            "risk_penalty": _penalty(flood_level, bucket),
        }, on_conflict="condo_id").execute()
        written += 1

    logger.info(
        f"risk: computed for {written} condos "
        f"(districts profiled: {len(construction_cache)})"
    )
    return written
