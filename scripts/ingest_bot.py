"""Ingest BOT macroeconomic + financial indicators into macro_indicators table.

Pulls the four BTWS_STAT reports defined in src.scrapers.bot.REPORTS and
upserts every (series_code, indicator_name, period) row.

Usage:
  python scripts/ingest_bot.py
  python scripts/ingest_bot.py --reports 223 409   # subset
  python scripts/ingest_bot.py --dry-run
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.bot import REPORTS, fetch_all  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--reports",
        nargs="+",
        type=int,
        default=None,
        help=f"BOT reportIDs to pull (default: all of {list(REPORTS)})",
    )
    ap.add_argument("--dry-run", action="store_true",
                    help="Print summary, do not write")
    args = ap.parse_args()

    rows = fetch_all(args.reports)
    if not rows:
        logger.warning("No rows fetched — nothing to upsert")
        return 1

    stats = Counter(r["series_code"] for r in rows)
    logger.info("Parsed rows per series:")
    for code, n in stats.most_common():
        logger.info(f"  {code:14s} {n} rows")

    if args.dry_run:
        # Show a few sample latest rows
        from operator import itemgetter
        rows_sorted = sorted(rows, key=itemgetter("period"), reverse=True)
        logger.info("\nSample latest rows:")
        for r in rows_sorted[:8]:
            logger.info(
                f"  {r['series_code']:14s} {r['period']}  "
                f"{r['indicator_name'][:48]:48s}  {r['value']}"
                f"{' p' if r['is_provisional'] else ''}"
            )
        logger.info("--dry-run: no DB writes")
        return 0

    client = get_client()

    # Tag with source='bot' and upsert in batches
    for r in rows:
        r["source"] = "bot"
    written = 0
    for i in range(0, len(rows), 500):
        batch = rows[i:i + 500]
        client.table("macro_indicators").upsert(
            batch,
            on_conflict="source,series_code,indicator_name,period",
        ).execute()
        written += len(batch)
        logger.info(f"  upserted {written}/{len(rows)}")

    logger.info(f"Done. {written} macro_indicators rows upserted from BOT.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
