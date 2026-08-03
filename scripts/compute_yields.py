"""Compute gross rental yield for every condo that has both sale and rent listings.

gross_yield_pct = (median_monthly_rent * 12) / median_sale_price * 100

Updates condos.avg_sale_price, avg_monthly_rent, gross_yield_pct,
yield_sample_sale, yield_sample_rent, yield_computed_at.

Currency normalisation: hipflat stores prices in USD (their page defaults to
"Price display: USD"), while dotproperty/ddproperty/fazwaz store THB. We
multiply non-THB rows by --thb-per-usd before aggregating so they're all on
the same scale.

Aggregation uses median, not mean, so a single mis-encoded listing (e.g. a
penthouse rent in a sea of studios) can't tilt the result.

Usage:
  python scripts/compute_yields.py [--min-samples 2] [--max-yield-pct 15] [--thb-per-usd 34] [--dry-run]
"""
from __future__ import annotations

import argparse
import io
import os
import statistics
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger
from src.db import get_client


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-samples", type=int, default=2,
                    help="Min listings required per type before computing yield")
    ap.add_argument("--max-yield-pct", type=float, default=15.0,
                    help="Drop computed yields above this (likely data error)")
    ap.add_argument("--thb-per-usd", type=float, default=34.0,
                    help="FX rate used to normalise USD-denominated rows (hipflat)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    def load_listings(listing_type: str) -> list[dict]:
        # PostgREST caps a single response at 1000 rows; paginate explicitly.
        out: list[dict] = []
        page_size = 1000
        offset = 0
        while True:
            batch = (
                client.table("listings")
                .select("condo_id, price, currency")
                .eq("listing_type", listing_type)
                .eq("is_active", True)
                .not_.is_("price", "null")
                .order("id")
                .range(offset, offset + page_size - 1)
                .execute()
                .data
            ) or []
            out.extend(batch)
            if len(batch) < page_size:
                return out
            offset += page_size

    logger.info("Loading sale listings...")
    sale_rows = load_listings("sale")
    logger.info(f"  loaded {len(sale_rows)} sale rows")

    logger.info("Loading rent listings...")
    rent_rows = load_listings("rent")
    logger.info(f"  loaded {len(rent_rows)} rent rows")

    def to_thb(row: dict) -> float | None:
        """THB rows pass through, USD rows convert at --thb-per-usd. Any other
        currency is excluded from the median inputs rather than taken at face
        value (a handful of live rows carry a third currency)."""
        currency = row.get("currency")
        price = float(row["price"])
        if currency == "THB":
            return price
        if currency == "USD":
            return price * args.thb_per_usd
        return None

    from collections import defaultdict
    sale_map: dict[str, list[float]] = defaultdict(list)
    rent_map: dict[str, list[float]] = defaultdict(list)

    skipped_currency = 0
    for r in sale_rows:
        thb = to_thb(r)
        if thb is None:
            skipped_currency += 1
            continue
        sale_map[r["condo_id"]].append(thb)
    for r in rent_rows:
        thb = to_thb(r)
        if thb is None:
            skipped_currency += 1
            continue
        rent_map[r["condo_id"]].append(thb)
    if skipped_currency:
        logger.debug(f"  skipped {skipped_currency} rows in unsupported currencies")

    both = set(sale_map) & set(rent_map)
    logger.info(f"  {len(sale_map)} condos with sale | {len(rent_map)} condos with rent | {len(both)} with both")

    updates = []
    dropped_outlier = 0
    for condo_id in both:
        s_prices = sale_map[condo_id]
        r_prices = rent_map[condo_id]
        if len(s_prices) < args.min_samples or len(r_prices) < args.min_samples:
            continue
        med_sale = statistics.median(s_prices)
        med_rent = statistics.median(r_prices)
        if med_sale <= 0:
            continue
        gross_yield = round((med_rent * 12) / med_sale * 100, 2)
        if gross_yield > args.max_yield_pct:
            dropped_outlier += 1
            continue
        updates.append({
            "id": condo_id,
            "avg_sale_price": round(med_sale, 2),
            "avg_monthly_rent": round(med_rent, 2),
            "gross_yield_pct": gross_yield,
            "yield_sample_sale": len(s_prices),
            "yield_sample_rent": len(r_prices),
            "yield_computed_at": now,
        })

    logger.info(f"  {len(updates)} condos will get yield computed ({dropped_outlier} dropped as > {args.max_yield_pct}% outlier)")

    if not args.dry_run:
        new_ids = {u["id"] for u in updates}

        # Clear stale yields first so re-runs with tighter criteria don't leave old values behind.
        existing: list[dict] = []
        offset = 0
        while True:
            chunk = (
                client.table("condos")
                .select("id")
                .not_.is_("gross_yield_pct", "null")
                .order("id")
                .range(offset, offset + 999)
                .execute()
                .data
            ) or []
            existing.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
        stale_ids = [e["id"] for e in existing if e["id"] not in new_ids]
        if stale_ids:
            logger.info(f"  clearing {len(stale_ids)} stale yield rows...")
            # Plain UPDATE, not upsert. This used to upsert on the assumption
            # that an id from `.select("id")` against condos (existing above)
            # could never take the INSERT path — but that race is real: if a
            # concurrent writer (e.g. the overnight discovery loop's own
            # scoring pass) deletes/replaces that condo row between the
            # SELECT and this UPSERT, PostgREST's ON CONFLICT falls through
            # to INSERT instead of UPDATE, and the INSERT fails on every
            # NOT NULL column this payload doesn't set (source, name, ...) —
            # hit in production 2026-08-01. UPDATE has no insert path: a
            # vanished id just matches zero rows instead of erroring.
            clear_fields = {
                "avg_sale_price": None,
                "avg_monthly_rent": None,
                "gross_yield_pct": None,
                "yield_sample_sale": None,
                "yield_sample_rent": None,
                "yield_computed_at": None,
            }
            for i in range(0, len(stale_ids), 500):
                client.table("condos").update(clear_fields, returning="minimal").in_(
                    "id", stale_ids[i:i + 500]
                ).execute()

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

    # Was a batched upsert(on_conflict="id") — removed after it kept killing
    # the whole run (2026-08-01/02, 3 separate occasions, each a different
    # condo_id). A prior fix pre-checked which ids still existed in `condos`
    # before upserting, which narrowed the window but didn't close it (a
    # third failure still got through), and PostgREST batches an upsert's
    # whole chunk as one SQL statement, so a single id taking the INSERT
    # path fails all 500 rows in that chunk on a NOT NULL violation. Per-row
    # UPDATE has no insert path at all — worth the extra HTTP round-trips
    # (thousands vs. ~7/run) to stop losing entire pipeline runs to one bad
    # id, and it made the pre-check moot so that's gone too.
    for u in updates:
        payload = {k: v for k, v in u.items() if k != "id"}
        client.table("condos").update(payload, returning="minimal").eq("id", u["id"]).execute()
    updated = len(updates)

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
