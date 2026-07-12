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
        # Clear stale yields first so re-runs with tighter criteria don't leave old values behind.
        new_ids = {u["id"] for u in updates}
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
            # Batched upsert instead of one UPDATE per row (was ~253 HTTP
            # round-trips/run). Safe: every id here came from a `.select("id")`
            # against condos (existing above), so ON CONFLICT always resolves
            # to UPDATE — the INSERT path (which would need every NOT NULL
            # column without a default, e.g. source/source_listing_id/name)
            # is never actually taken. Matches scripts/compute_value_scores.py's
            # chunked-upsert pattern.
            clear_rows = [{
                "id": sid,
                "avg_sale_price": None,
                "avg_monthly_rent": None,
                "gross_yield_pct": None,
                "yield_sample_sale": None,
                "yield_sample_rent": None,
                "yield_computed_at": None,
            } for sid in stale_ids]
            for i in range(0, len(clear_rows), 500):
                client.table("condos").upsert(
                    clear_rows[i:i + 500], on_conflict="id", returning="minimal"
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

    # Batched upsert instead of one UPDATE per condo (was ~3,370 HTTP
    # round-trips/run at full scrape volume). Safe for the same reason as
    # the stale-clear pass above: every "id" here comes from listings whose
    # condo_id already has a row in `condos`, so ON CONFLICT always resolves
    # to UPDATE and no NOT NULL column is left unset.
    UPSERT_CHUNK = 500
    for i in range(0, len(updates), UPSERT_CHUNK):
        client.table("condos").upsert(
            updates[i:i + UPSERT_CHUNK], on_conflict="id", returning="minimal"
        ).execute()
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
