"""Run DDProperty ingest across all supported Thai cities (sale + rent).

Usage:
  python scripts/sweep_ddproperty_thailand.py
  python scripts/sweep_ddproperty_thailand.py --delay-s 60
  python scripts/sweep_ddproperty_thailand.py --cities bangkok phuket
"""
from __future__ import annotations

import argparse
import asyncio
import io
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger
from scripts.ingest_ddproperty import CITY_SLUGS, run as ingest_run

# Cities in priority order (investment interest + data richness)
DEFAULT_CITIES = ["bangkok", "phuket", "pattaya", "chiang-mai", "hua-hin"]

# Extra delay between cities so browser can settle
INTER_CITY_DELAY_S = 60


async def sweep(cities: list[str], delay_s: float) -> None:
    total_cities = len(cities)
    for i, city in enumerate(cities, 1):
        for listing_type in ("sale", "rent"):
            logger.info(
                f"=== [{i}/{total_cities}] {city.upper()} — {listing_type} ==="
            )
            try:
                await ingest_run(listing_type, delay_s, max_listings=None, city=city)
            except Exception as e:
                logger.error(f"[sweep] {city} {listing_type} failed: {e}")
            logger.info(f"[sweep] sleeping {INTER_CITY_DELAY_S}s before next run...")
            await asyncio.sleep(INTER_CITY_DELAY_S)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cities",
        nargs="+",
        choices=list(CITY_SLUGS.keys()),
        default=DEFAULT_CITIES,
    )
    ap.add_argument("--delay-s", type=float, default=45.0)
    args = ap.parse_args()
    logger.info(f"DDProperty sweep: {args.cities}  delay={args.delay_s}s/page")
    asyncio.run(sweep(args.cities, args.delay_s))


if __name__ == "__main__":
    main()
