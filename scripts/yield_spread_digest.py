"""Send yield-spread (gross yield minus MRR) digest to ops Telegram.

Pairs `condos.gross_yield_pct` with the most recent BOT MRR loaded into
`macro_indicators` to rank condos by how much their gross yield exceeds
the mortgage benchmark.

Usage:
  python scripts/yield_spread_digest.py
  python scripts/yield_spread_digest.py --top 5 --min-spread 2 --dry-run
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

from src.analysis.yield_spread import (  # noqa: E402
    build_digest,
    get_current_mortgage_rate,
    send_spread_digest,
)
from src.db import get_client  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--min-spread", type=float, default=1.0,
                    help="Min spread over MRR in percentage points (default 1.0)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    rate = get_current_mortgage_rate(client)
    if rate:
        logger.info(f"MRR benchmark: {rate[0]:.2f}% (period {rate[1]})")
    else:
        logger.warning("MRR not loaded yet — run scripts/ingest_bot.py")
        return 1

    if args.dry_run:
        msg = build_digest(client, top_n=args.top, min_spread_pp=args.min_spread)
        if msg is None:
            logger.info(
                f"No condos with yield > MRR + {args.min_spread:.1f}pp "
                f"(threshold {rate[0] + args.min_spread:.2f}%)"
            )
            return 0
        print(msg)
        return 0

    send_spread_digest(client, top_n=args.top, min_spread_pp=args.min_spread)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
