"""Recompute the per-developer report-card aggregates (developers table).

Run after the foreign-quota scrape (which tags condos.developer_slug). Cheap,
DB-only.

Usage:
  python scripts/compute_developer_stats.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.analysis.developer import compute_developer_stats  # noqa: E402
from src.db import get_client  # noqa: E402


def main() -> int:
    n = compute_developer_stats(get_client())
    print(f"computed stats for {n} developers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
