"""DDProperty sale-only sweep in user-specified city order.

Bangkok first, then Pattaya, Phuket, Chiang Mai, Hua Hin (priority for
foreign-buyer investment demand). Rent listings are a separate later
pass — sale data gets us yields + the largest market.

One nodriver browser, sequential cities. ~30-60min per Bangkok-sized
city at the default 20s page delay; smaller cities much faster.

Usage:
  python scripts/sweep_ddproperty_sale_only.py
  python scripts/sweep_ddproperty_sale_only.py --cities pattaya phuket
  python scripts/sweep_ddproperty_sale_only.py --delay-s 30  # politer
"""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from scripts.ingest_ddproperty import CITY_SLUGS, run as ingest_run  # noqa: E402

# User-specified priority order (foreign-buyer market value).
DEFAULT_CITIES = ["bangkok", "pattaya", "phuket", "chiang-mai", "hua-hin"]

# Settle time between cities so the browser/profile/CF cookies stabilise.
INTER_CITY_DELAY_S = 90


async def sweep(cities: list[str], delay_s: float) -> None:
    total = len(cities)
    for i, city in enumerate(cities, 1):
        logger.info(f"=== [{i}/{total}] {city.upper()} — sale ===")
        try:
            await ingest_run("sale", delay_s, max_listings=None, city=city)
        except Exception as e:
            logger.error(f"[sweep] {city} sale failed: {e}")
        if i < total:
            logger.info(f"[sweep] sleeping {INTER_CITY_DELAY_S}s before next city...")
            await asyncio.sleep(INTER_CITY_DELAY_S)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cities",
        nargs="+",
        choices=list(CITY_SLUGS.keys()),
        default=DEFAULT_CITIES,
    )
    ap.add_argument("--delay-s", type=float, default=20.0)
    args = ap.parse_args()
    logger.info(
        f"DDProperty SALE-only sweep: {args.cities}  delay={args.delay_s}s/page"
    )
    asyncio.run(sweep(args.cities, args.delay_s))


if __name__ == "__main__":
    main()
