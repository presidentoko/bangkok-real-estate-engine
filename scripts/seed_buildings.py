"""Seed the buildings inventory (hipflat Phase 1).

Walks hipflat L1 → L2 for the given property type × region and upserts one row
per building into `condos`. No listings/price_history rows are written here —
those come from Phase 2 once per-building scrapes are implemented.

Non-bangkok regions are seeded with `published=false` so the site doesn't
expose them until we flip the gate.

Usage:
    python scripts/seed_buildings.py                                  # condo, bangkok
    python scripts/seed_buildings.py --cap 200                        # cap 200
    python scripts/seed_buildings.py --type apartment                 # apartment, bangkok
    python scripts/seed_buildings.py --region pattaya                 # condo, pattaya
    python scripts/seed_buildings.py --type condo --region huahin     # condo, huahin
"""
from __future__ import annotations

import argparse
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client, upsert_condo  # noqa: E402
from src.scrapers import hipflat  # noqa: E402


DEFAULT_CAP = 2000  # comfortably above ~1,500 expected total


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", "--property-type", dest="property_type",
                    default="condo", choices=hipflat.SUPPORTED_PROPERTY_TYPES)
    ap.add_argument("--region", default=hipflat.DEFAULT_REGION,
                    choices=tuple(hipflat.REGION_ROOTS))
    ap.add_argument("--cap", type=int, default=DEFAULT_CAP)
    # Back-compat with positional cap (`python seed_buildings.py 200`).
    ap.add_argument("positional_cap", nargs="?", type=int, default=None)
    args = ap.parse_args()
    cap = args.positional_cap if args.positional_cap is not None else args.cap

    supabase = get_client()
    logger.info(f"[seed] type={args.property_type}  region={args.region}  cap={cap}")

    seeded = 0
    failed = 0
    async for building in hipflat.scrape(
        cap, property_type=args.property_type, region=args.region,
    ):
        try:
            upsert_condo(supabase, building)
            seeded += 1
            if seeded % 25 == 0:
                logger.info(f"[seed] {seeded} buildings persisted so far")
        except Exception as e:
            failed += 1
            logger.warning(
                f"[seed] upsert failed ({building.get('source_listing_id')}): {e}"
            )

    logger.info(f"[seed] done — {seeded} buildings seeded, {failed} failed")


if __name__ == "__main__":
    # nodriver requires its own event-loop helper — stock asyncio.run leaves
    # navigation unscheduled and the browser stuck on "New Tab".
    uc.loop().run_until_complete(main())
