"""Compute bubble_index per building from listings.

Strategy
--------
1. Pull all listings with price_per_sqm set, group by (condo, listing_type).
2. Building median pps per (condo, listing_type) — use median to reduce
   noise from one-off luxury units or fire-sale outliers.
3. Region median pps per (region, listing_type) — across all buildings'
   listings in that region. Same robustness reasoning.
4. bubble_index = building_pps / region_pps * 100  (100 = at-market, >100 = premium)
   - Prefer SALE comparison; fall back to RENT if no sale data exists.
   - This is what RealityCard already reads (value_scores.bubble_index).
5. Side-effect: store regions.avg_price_per_sqm = SALE region median (or rent
   if no sale), so the existing /reality page's region-avg display works too.

Currency
--------
hipflat exposes everything in USD on the L3 page; Tier B captured USD prices
verbatim. We compute everything in USD; the dashboard renders the value as-is.

Usage:
  python scripts/compute_value_scores.py
  python scripts/compute_value_scores.py --dry-run
"""
from __future__ import annotations

import argparse
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

PAGE = 1000
MIN_LISTINGS_FOR_REGION = 5  # below this, region median is not trustworthy


def _fetch_all(client, table: str, columns: str, **filters) -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        q = client.table(table).select(columns)
        for k, v in filters.items():
            q = q.eq(k, v)
        page = q.range(offset, offset + PAGE - 1).execute().data or []
        out.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    return out


def _median(xs: list[float]) -> float | None:
    return statistics.median(xs) if xs else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()

    # ---- Pull listings with pps set
    listings = _fetch_all(
        client,
        "listings",
        "condo_id, listing_type, price_per_sqm",
        source="hipflat",
    )
    listings = [l for l in listings if l.get("price_per_sqm") is not None]
    logger.info(f"listings with pps: {len(listings)}")

    # ---- Pull condos for region lookup
    condos = _fetch_all(client, "condos", "id, region_id", source="hipflat")
    region_by_condo = {c["id"]: c.get("region_id") for c in condos}

    # ---- Group: (condo, type) -> [pps]
    by_condo_type: dict[tuple[str, str], list[float]] = defaultdict(list)
    for l in listings:
        cid = l["condo_id"]
        t = l["listing_type"]
        by_condo_type[(cid, t)].append(float(l["price_per_sqm"]))

    # ---- Group: (region, type) -> [pps] (every listing contributes; use
    #      building median first to weight buildings equally? simpler: use
    #      raw listing pps medians since that smooths within-building too)
    by_region_type: dict[tuple[str, str], list[float]] = defaultdict(list)
    for (cid, t), pps_list in by_condo_type.items():
        rid = region_by_condo.get(cid)
        if not rid:
            continue
        b_med = _median(pps_list)
        if b_med is None:
            continue
        # One vote per building per type (avoid letting big buildings dominate).
        by_region_type[(rid, t)].append(b_med)

    region_medians: dict[tuple[str, str], float] = {}
    for k, vals in by_region_type.items():
        if len(vals) < MIN_LISTINGS_FOR_REGION:
            continue
        region_medians[k] = statistics.median(vals)
    logger.info(
        f"regions with sale median: {sum(1 for k in region_medians if k[1]=='sale')}, "
        f"with rent median: {sum(1 for k in region_medians if k[1]=='rent')}"
    )

    # ---- Compute per-building bubble_index
    now = datetime.now(timezone.utc).isoformat()
    score_rows: list[dict] = []
    n_sale_used = n_rent_used = n_no_match = 0

    for cid in {l["condo_id"] for l in listings}:
        rid = region_by_condo.get(cid)
        if not rid:
            n_no_match += 1
            continue
        # SALE preferred
        period = None
        b_med = None
        r_med = None
        sale_list = by_condo_type.get((cid, "sale"))
        if sale_list and (rid, "sale") in region_medians:
            b_med = _median(sale_list)
            r_med = region_medians[(rid, "sale")]
            period = "sale"
            n_sale_used += 1
        else:
            rent_list = by_condo_type.get((cid, "rent"))
            if rent_list and (rid, "rent") in region_medians:
                b_med = _median(rent_list)
                r_med = region_medians[(rid, "rent")]
                period = "rent"
                n_rent_used += 1
            else:
                n_no_match += 1
                continue
        if not r_med or r_med <= 0 or b_med is None:
            continue
        bubble_index = round(b_med / r_med * 100, 2)
        # value_scores.bubble_index is numeric(6,2) — max 9999.99. Anything
        # above that is invariably bad data (mis-parsed area driving pps to
        # the moon, or a single luxe unit in a sparse region). Cap and log.
        if bubble_index > 9999.99:
            logger.warning(
                f"capping bubble_index for {cid}: {bubble_index} -> 9999.99 "
                f"(b_med={b_med}, r_med={r_med}, period={period})"
            )
            bubble_index = 9999.99
        score_rows.append({
            "condo_id": cid,
            "bubble_index": bubble_index,
            "computed_at": now,
        })

    logger.info(
        f"value_scores rows: {len(score_rows)} "
        f"(sale={n_sale_used}, rent={n_rent_used}, no-match={n_no_match})"
    )

    # ---- Region avg_price_per_sqm: prefer SALE median, fallback to rent
    region_avg_rows: list[dict] = []
    seen_regions: set[str] = set()
    for (rid, t), med in region_medians.items():
        if t == "sale":
            seen_regions.add(rid)
            region_avg_rows.append({"id": rid, "avg_price_per_sqm": round(med, 2)})
    for (rid, t), med in region_medians.items():
        if t == "rent" and rid not in seen_regions:
            seen_regions.add(rid)
            region_avg_rows.append({"id": rid, "avg_price_per_sqm": round(med, 2)})
    logger.info(f"regions to update: {len(region_avg_rows)}")

    if args.dry_run:
        logger.info("dry-run — not writing")
        if score_rows:
            logger.info(f"sample bubble_index: {sorted(s['bubble_index'] for s in score_rows)[:5]} ... {sorted(s['bubble_index'] for s in score_rows)[-5:]}")
        return 0

    # ---- Write
    # regions.id refs an existing row (FK from condos.region_id). Use UPDATE
    # so we don't trip the NOT NULL constraint on `name` that would fire if
    # supabase-py treated this as an INSERT path.
    now_iso = datetime.now(timezone.utc).isoformat()
    for r in region_avg_rows:
        client.table("regions").update({
            "avg_price_per_sqm": r["avg_price_per_sqm"],
            "last_recalculated_at": now_iso,
        }).eq("id", r["id"]).execute()
    logger.info(f"updated {len(region_avg_rows)} regions")

    if score_rows:
        for i in range(0, len(score_rows), 500):
            client.table("value_scores").upsert(
                score_rows[i:i+500], on_conflict="condo_id"
            ).execute()
        logger.info(f"upserted {len(score_rows)} value_scores rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
