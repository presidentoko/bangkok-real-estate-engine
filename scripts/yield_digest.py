"""Send top-yield condos digest to ops Telegram chat.

Reads condos.gross_yield_pct (set by scripts/compute_yields.py) and posts
the top N condos meeting min_yield + min_samples thresholds in MarkdownV2
to TELEGRAM_CHAT_ID.

Usage:
  python scripts/yield_digest.py
  python scripts/yield_digest.py --top 5 --min-yield 7 --min-samples 3
  python scripts/yield_digest.py --dry-run
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

from src.analysis.yield_digest import build_digest, send_yield_digest  # noqa: E402
from src.db import get_client  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--min-yield", type=float, default=6.0)
    ap.add_argument("--min-samples", type=int, default=2)
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the digest instead of sending")
    args = ap.parse_args()

    client = get_client()
    if args.dry_run:
        msg = build_digest(
            client,
            top_n=args.top,
            min_yield=args.min_yield,
            min_samples=args.min_samples,
        )
        if msg is None:
            logger.info(
                f"No condos with yield ≥ {args.min_yield}% and "
                f"≥{args.min_samples} samples"
            )
            return 0
        print(msg)
        return 0

    send_yield_digest(
        client,
        top_n=args.top,
        min_yield=args.min_yield,
        min_samples=args.min_samples,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
