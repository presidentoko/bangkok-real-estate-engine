"""Send top price movers (drops + jumps) to ops Telegram chat.

Reads price_history.delta_pct from the latest snapshot per (condo, listing_type)
and posts the biggest moves in MarkdownV2 to TELEGRAM_CHAT_ID.

Runs cheaply (one query, no scraping). Intended to be called weekly after
scripts/snapshot_prices.py. Silent if delta_pct is unpopulated (first
snapshot has no baseline).

Usage:
  python scripts/price_movers_digest.py
  python scripts/price_movers_digest.py --top 10 --min-delta 5
  python scripts/price_movers_digest.py --dry-run    # print, don't send
"""
from __future__ import annotations

import argparse
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.analysis.price_movers import (  # noqa: E402
    build_digest,
    send_price_movers_digest,
)
from src.db import get_client  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=5, help="Top N drops + N jumps")
    ap.add_argument(
        "--min-delta",
        type=float,
        default=3.0,
        help="Minimum |delta_pct| to include (default 3.0)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the digest to stdout instead of sending",
    )
    args = ap.parse_args()

    client = get_client()
    if args.dry_run:
        msg = build_digest(client, top_n=args.top, min_abs_delta=args.min_delta)
        if msg is None:
            logger.info("No movers cross the threshold — nothing to send")
            return 0
        print(msg)
        return 0
    return 0 if send_price_movers_digest(
        client, top_n=args.top, min_abs_delta=args.min_delta
    ) >= 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
