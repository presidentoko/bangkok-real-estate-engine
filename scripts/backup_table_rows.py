"""Dump selected columns of a table (optionally filtered) to a CSV backup.

Used before a bulk data repair so every touched value can be restored.

    python scripts/backup_table_rows.py condos "id,slug,region_id,province" \
        data/backups/condos_geo_20261117.csv [--not-null gross_yield_pct] [--eq province=bangkok]
"""
from __future__ import annotations

import argparse
import csv
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.db import get_client  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("table")
    ap.add_argument("columns")
    ap.add_argument("out")
    ap.add_argument("--order", default="id")
    ap.add_argument("--not-null", action="append", default=[])
    ap.add_argument("--eq", action="append", default=[], help="col=value")
    args = ap.parse_args()

    client = get_client()
    rows: list[dict] = []
    offset = 0
    while True:
        q = client.table(args.table).select(args.columns).order(args.order)
        for col in args.not_null:
            q = q.not_.is_(col, "null")
        for cond in args.eq:
            k, v = cond.split("=", 1)
            q = q.eq(k, v)
        page = q.range(offset, offset + 999).execute().data or []
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    cols = [c.strip() for c in args.columns.split(",")]
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} rows -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
