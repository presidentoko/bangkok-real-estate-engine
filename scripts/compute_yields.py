"""Compute gross rental yield for every condo that has both sale and rent listings.

gross_yield_pct = (avg_monthly_rent * 12) / avg_sale_price * 100

Updates condos.avg_sale_price, avg_monthly_rent, gross_yield_pct,
yield_sample_sale, yield_sample_rent, yield_computed_at.

Usage:
  python scripts/compute_yields.py [--min-samples 2] [--dry-run]
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger
from src.db import get_client


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-samples", type=int, default=1,
                    help="Min listings required per type before computing yield")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    logger.info("Loading sale listings (avg price per condo)...")
    sale_rows = (
        client.table("listings")
        .select("condo_id, price")
        .eq("listing_type", "sale")
        .eq("is_active", True)
        .not_.is_("price", "null")
        .execute()
        .data
    ) or []

    logger.info("Loading rent listings (avg price per condo)...")
    rent_rows = (
        client.table("listings")
        .select("condo_id, price")
        .eq("listing_type", "rent")
        .eq("is_active", True)
        .not_.is_("price", "null")
        .execute()
        .data
    ) or []

    # Aggregate by condo_id
    from collections import defaultdict
    sale_map: dict[str, list[float]] = defaultdict(list)
    rent_map: dict[str, list[float]] = defaultdict(list)

    for r in sale_rows:
        sale_map[r["condo_id"]].append(float(r["price"]))
    for r in rent_rows:
        rent_map[r["condo_id"]].append(float(r["price"]))

    # Find condos with both
    both = set(sale_map) & set(rent_map)
    logger.info(f"  {len(sale_map)} condos with sale | {len(rent_map)} condos with rent | {len(both)} with both")

    updates = []
    for condo_id in both:
        s_prices = sale_map[condo_id]
        r_prices = rent_map[condo_id]
        if len(s_prices) < args.min_samples or len(r_prices) < args.min_samples:
            continue
        avg_sale = sum(s_prices) / len(s_prices)
        avg_rent = sum(r_prices) / len(r_prices)
        if avg_sale <= 0:
            continue
        gross_yield = round((avg_rent * 12) / avg_sale * 100, 2)
        updates.append({
            "id": condo_id,
            "avg_sale_price": round(avg_sale, 2),
            "avg_monthly_rent": round(avg_rent, 2),
            "gross_yield_pct": gross_yield,
            "yield_sample_sale": len(s_prices),
            "yield_sample_rent": len(r_prices),
            "yield_computed_at": now,
        })

    logger.info(f"  {len(updates)} condos will get yield computed")

    if args.dry_run:
        # Show distribution
        yields = sorted(u["gross_yield_pct"] for u in updates)
        if yields:
            buckets = [(0,3),(3,5),(5,7),(7,10),(10,9999)]
            for lo, hi in buckets:
                count = sum(1 for y in yields if lo <= y < hi)
                label = f"{lo}-{hi}%" if hi < 9999 else f"{lo}%+"
                logger.info(f"  yield {label:10s}: {count} condos")
            logger.info(f"  median yield: {yields[len(yields)//2]:.2f}%")
        logger.info("--dry-run: no DB writes")
        return

    # Update each condo individually (all rows already exist)
    updated = 0
    for u in updates:
        condo_id = u.pop("id")
        client.table("condos").update(u).eq("id", condo_id).execute()
        updated += 1
        if updated % 50 == 0:
            logger.info(f"  updated {updated}/{len(updates)}")

    logger.info(f"Done. {updated} condos updated with gross yield.")

    # Quick stats
    high_yield = [u for u in updates if u["gross_yield_pct"] >= 6]
    logger.info(f"  >= 6% yield: {len(high_yield)} condos")
    if high_yield:
        top5 = sorted(high_yield, key=lambda x: x["gross_yield_pct"], reverse=True)[:5]
        for u in top5:
            logger.info(f"    yield={u['gross_yield_pct']}% "
                        f"sale={u['avg_sale_price']:,.0f} rent={u['avg_monthly_rent']:,.0f}/mo")


if __name__ == "__main__":
    main()
