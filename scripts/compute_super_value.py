"""Compute is_super_value flag (top 5% on bubble_index AND livability_score).

Wraps src/analysis/super_value.compute_super_value with a CLI entry. Run after
both compute_value_scores.py and populate_livability_osm.py have finished.

Usage:
  python scripts/compute_super_value.py
  python scripts/compute_super_value.py --top-pct 10
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.analysis.super_value import compute_super_value  # noqa: E402
from src.db import get_client  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--top-pct", type=float, default=5.0)
    args = ap.parse_args()
    n = compute_super_value(get_client(), top_pct=args.top_pct)
    print(f"flagged {n} buildings as super-value (top {args.top_pct}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
