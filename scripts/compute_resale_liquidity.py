"""Compute the Resale Liquidity Score (0-100) for every condo with enough
hipflat listing history, and upsert it onto value_scores.

"If I buy here, can I get my money back out?" — a question no portal answers.
We can, because we know each listing's real time-to-clear (see
src/analysis/liquidity for the formula). Run after a scrape pass so newly
absorbed/expired listings are reflected.

Usage:
  python scripts/compute_resale_liquidity.py
  python scripts/compute_resale_liquidity.py --window-days 90
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.analysis.liquidity import WINDOW_DAYS, compute_liquidity_scores  # noqa: E402
from src.db import get_client  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--window-days", type=int, default=WINDOW_DAYS,
                    help="Only count listings absorbed within this trailing window.")
    args = ap.parse_args()
    n = compute_liquidity_scores(get_client(), window_days=args.window_days)
    print(f"liquidity scored for {n} condos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
