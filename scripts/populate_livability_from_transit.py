"""Populate livability_metrics.nearest_bts_* from condo_transit FAQ data.

hipflat's FAQ "What BTS and MRT stations is X close to?" lists 1-3 stations
per building. We don't get a measured distance; the page only asserts "close
to" in qualitative language. We pick the FIRST station per line as the
"nearest" and tag distance as the placeholder NEAR_DISTANCE_M, recording the
source so a later coordinate-based pass (OSM Overpass + lat/lng) can replace
it cleanly.

Usage:
  python scripts/populate_livability_from_transit.py
  python scripts/populate_livability_from_transit.py --dry-run

After the eventual OSM-distance pass exists, this script becomes a fallback
for buildings the precise pass couldn't resolve.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

# Placeholder distance — hipflat's "close to" is fuzzy. 800m is the upper
# bound of what most listing sites consider walkable to a station; this lets
# RealityCard's Transit signal fire as "neutral" rather than "supports" until
# we have a real measurement.
NEAR_DISTANCE_M = 800
SOURCE_TAG = "hipflat_faq"


def _fetch_all_transit(client) -> list[dict]:
    PAGE = 1000
    out: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table("condo_transit")
            .select("condo_id, line, station, source")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        ) or []
        out.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    rows = _fetch_all_transit(client)
    logger.info(f"loaded {len(rows)} transit rows")

    # Group by condo, preserve first-seen order per (condo, line).
    by_condo: dict[str, dict[str, str]] = {}
    for r in rows:
        cid = r["condo_id"]
        line = r["line"]
        if not cid or line not in ("BTS", "MRT"):
            continue
        d = by_condo.setdefault(cid, {})
        if line not in d:
            d[line] = r["station"]

    logger.info(f"distinct condos with usable transit: {len(by_condo)}")

    # Pull existing livability rows so we don't blow away precise distances
    # that some other pass may have written.
    existing: dict[str, dict] = {}
    PAGE = 1000
    offset = 0
    while True:
        page = (
            client.table("livability_metrics")
            .select("condo_id, nearest_bts_distance_m, nearest_mrt_distance_m, "
                    "nearest_bts_station, nearest_mrt_station")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        ) or []
        for r in page:
            existing[r["condo_id"]] = r
        if len(page) < PAGE:
            break
        offset += PAGE
    logger.info(f"existing livability_metrics rows: {len(existing)}")

    now = datetime.now(timezone.utc).isoformat()
    upserts: list[dict] = []
    n_new = n_filled = n_kept = 0

    for cid, lines in by_condo.items():
        ex = existing.get(cid, {})
        bts_station = lines.get("BTS")
        mrt_station = lines.get("MRT")

        # If precise data already exists (distance set by a non-FAQ source
        # later — i.e. a real OSM measurement), don't overwrite. We use the
        # convention that FAQ-derived rows store NEAR_DISTANCE_M; any other
        # value means a precise measurement and we leave it alone.
        bts_dist = ex.get("nearest_bts_distance_m")
        mrt_dist = ex.get("nearest_mrt_distance_m")
        bts_dist_keep = bts_dist is not None and bts_dist != NEAR_DISTANCE_M
        mrt_dist_keep = mrt_dist is not None and mrt_dist != NEAR_DISTANCE_M

        payload: dict = {"condo_id": cid, "computed_at": now}
        if bts_station and not bts_dist_keep:
            payload["nearest_bts_station"] = bts_station
            payload["nearest_bts_distance_m"] = NEAR_DISTANCE_M
            n_filled += 1
        elif bts_dist_keep:
            n_kept += 1
        if mrt_station and not mrt_dist_keep:
            payload["nearest_mrt_station"] = mrt_station
            payload["nearest_mrt_distance_m"] = NEAR_DISTANCE_M
            n_filled += 1
        elif mrt_dist_keep:
            n_kept += 1

        # Only upsert if there's something new to write.
        if len(payload) > 2:
            if cid not in existing:
                n_new += 1
            upserts.append(payload)

    logger.info(f"prepared {len(upserts)} upserts (new={n_new}, fields filled={n_filled}, kept={n_kept})")

    if args.dry_run:
        logger.info("dry-run — not writing")
        if upserts:
            logger.info(f"sample: {upserts[0]}")
        return 0

    if not upserts:
        return 0
    for i in range(0, len(upserts), 500):
        client.table("livability_metrics").upsert(
            upserts[i:i+500], on_conflict="condo_id"
        ).execute()
    logger.info(f"wrote {len(upserts)} livability_metrics rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
