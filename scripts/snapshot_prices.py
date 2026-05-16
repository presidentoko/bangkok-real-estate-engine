"""Snapshot current listing prices into price_history with delta vs last snapshot.

Run once per week after the scrape completes. Inserts one row per
(condo_id, listing_type) with the current avg price and delta_pct vs the
previous snapshot. First run: delta_pct is NULL (no prior snapshot).

Usage:
  python scripts/snapshot_prices.py [--dry-run]
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger
from src.db import get_client


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # Current avg prices per (condo_id, listing_type)
    logger.info("Loading active listings (all pages)...")
    rows = []
    offset = 0
    while True:
        chunk = (
            client.table("listings")
            .select("condo_id, listing_type, price, price_per_sqm")
            .eq("is_active", True)
            .not_.is_("price", "null")
            .range(offset, offset + 999)
            .execute()
            .data
        ) or []
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    logger.info(f"  loaded {len(rows)} active listings")

    current: dict[tuple[str, str], list] = defaultdict(list)
    for r in rows:
        current[(r["condo_id"], r["listing_type"])].append(
            (float(r["price"]), float(r["price_per_sqm"]) if r.get("price_per_sqm") else None)
        )
    logger.info(f"  {len(current)} (condo, type) pairs from {len(rows)} listings")

    # Last snapshot per (condo_id, listing_type)
    logger.info("Loading last price snapshots...")
    prev_rows = (
        client.table("price_history")
        .select("condo_id, listing_type, price, captured_at")
        .order("captured_at", desc=True)
        .limit(50000)
        .execute()
        .data
    ) or []

    prev: dict[tuple[str, str], float] = {}
    for r in prev_rows:
        key = (r["condo_id"], r["listing_type"])
        if key not in prev:
            prev[key] = float(r["price"])
    logger.info(f"  {len(prev)} prior snapshots loaded")

    # Build inserts
    inserts = []
    price_changes = []
    for (condo_id, ltype), prices in current.items():
        avg_price = sum(p for p, _ in prices) / len(prices)
        pps_vals = [ps for _, ps in prices if ps is not None]
        avg_pps = sum(pps_vals) / len(pps_vals) if pps_vals else None

        prior = prev.get((condo_id, ltype))
        delta_pct = None
        if prior and prior > 0:
            delta_pct = round((avg_price - prior) / prior * 100, 2)
            if abs(delta_pct) >= 1.0:
                price_changes.append((condo_id, ltype, prior, avg_price, delta_pct))

        inserts.append({
            "condo_id": condo_id,
            "listing_type": ltype,
            "price": round(avg_price, 2),
            "price_per_sqm": round(avg_pps, 2) if avg_pps else None,
            "delta_pct": delta_pct,
            "captured_at": now,
        })

    logger.info(f"  {len(inserts)} snapshots to insert")
    logger.info(f"  {len(price_changes)} condos with >=1% price change")

    if price_changes:
        ups = [c for c in price_changes if c[4] > 0]
        downs = [c for c in price_changes if c[4] < 0]
        logger.info(f"    up: {len(ups)}  down: {len(downs)}")
        for _, ltype, old, new, delta in sorted(price_changes, key=lambda x: abs(x[4]), reverse=True)[:5]:
            logger.info(f"    {ltype:4s} {old:>12,.0f} -> {new:>12,.0f} THB  ({delta:+.1f}%)")

    if args.dry_run:
        logger.info("--dry-run: no DB writes")
        return

    # Insert in batches
    batch_size = 500
    inserted = 0
    for i in range(0, len(inserts), batch_size):
        batch = inserts[i : i + batch_size]
        client.table("price_history").insert(batch).execute()
        inserted += len(batch)
        logger.info(f"  inserted {inserted}/{len(inserts)}")

    logger.info(f"Done. {inserted} price snapshots recorded.")


if __name__ == "__main__":
    main()
