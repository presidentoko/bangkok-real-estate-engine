"""Verify the hipflat Phase 1 seed: count, per-khet distribution, samples."""
from __future__ import annotations

import io
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import get_client  # noqa: E402


def main() -> None:
    sb = get_client()

    # 1) Total buildings from hipflat
    total = (
        sb.table("condos")
        .select("id", count="exact")
        .eq("source", "hipflat")
        .execute()
    )
    n_total = total.count
    print(f"Total hipflat buildings in DB: {n_total}")

    # 2) Per-khet distribution. Pull region_id with each row, join names.
    rows = (
        sb.table("condos")
        .select("region_id", count="exact")
        .eq("source", "hipflat")
        .execute()
    )
    by_region_id = Counter(r.get("region_id") for r in (rows.data or []))

    # Map region_id → name
    region_ids = [rid for rid in by_region_id if rid]
    name_by_id: dict[str, str] = {}
    if region_ids:
        regs = (
            sb.table("regions")
            .select("id, name")
            .in_("id", region_ids)
            .execute()
        )
        name_by_id = {r["id"]: r["name"] for r in (regs.data or [])}

    print(f"\nDistinct regions touched: {len(by_region_id)} "
          f"(NULL region_id buckets: {by_region_id.get(None, 0)})")
    print("\nPer-khet building counts (descending):")
    rows_for_print = sorted(
        by_region_id.items(), key=lambda kv: kv[1], reverse=True
    )
    for rid, count in rows_for_print:
        label = name_by_id.get(rid, "(unresolved)") if rid else "(NULL)"
        print(f"  {count:>4}  {label}")

    # 3) 5 sample rows
    sample = (
        sb.table("condos")
        .select("source_listing_id, name, region_id, url")
        .eq("source", "hipflat")
        .limit(5)
        .execute()
    )
    print("\nSample rows:")
    for r in (sample.data or []):
        rid = r.get("region_id")
        khet = name_by_id.get(rid, "(unresolved)") if rid else "(NULL)"
        print(f"  [{r['source_listing_id']}] {r['name']!r}  khet={khet}")
        print(f"     {r['url']}")

    # 4) Compare against expected 50 Bangkok khet
    print(f"\nExpected ~50 khet, got distinct regions: {len(by_region_id)}")
    if n_total != 1088:
        print(f"⚠  log said 1088 seeded; DB has {n_total}")


if __name__ == "__main__":
    main()
