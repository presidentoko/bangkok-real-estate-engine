"""Bubble Index = sale_listing_pps / region_avg_sale_pps × 100.

> 100 = priced above regional average ("bubble" suspicion).
< 100 = priced below regional average ("undervalued" candidate).

Sale listings only, on BOTH sides of the ratio. Until migration 014 this
read v_latest_listings, which is the latest listing per condo regardless of
listing_type and therefore mixes sale prices (median 72,172 THB/sqm) with
monthly rents (median 297 THB/sqm) in a single column — see
supabase/migrations/014_sale_only_region_averages.sql for the full write-up.
"""
from __future__ import annotations

from loguru import logger
from supabase import Client

from src.db import fetch_all

# Plausible range for a real district premium/discount, as a percentage of the
# district average. 4x above or 1/10th of the district average is already an
# extreme building; past that it is a data-quality artifact.
BI_FLOOR = 10.0
BI_CEILING = 400.0


def compute_bubble_indices(client: Client) -> int:
    """Compute and upsert bubble_index for every active condo. Returns count."""
    client.rpc("recompute_region_averages", {}).execute()

    # All three reads MUST paginate. As plain .select().execute() calls they
    # silently stopped at PostgREST's 1000-row cap, so this function scored
    # 1,297 of 15,785 active condos (8.2%) — every other condo page shipped
    # without the "priced X% above district average" line that is the whole
    # point of the value layer. Found 2026-08-13; see fetch_all's docstring.
    condos = fetch_all(client, "condos", "id, region_id", is_active=True)
    # v_latest_sale_listings is one row per condo — condo_id is its stable
    # unique key, so it's the correct ORDER BY for paging.
    listings = fetch_all(
        client, "v_latest_sale_listings", "condo_id, price_per_sqm", order_by="condo_id"
    )
    regions = fetch_all(client, "regions", "id, avg_price_per_sqm")

    region_avg = {
        r["id"]: float(r["avg_price_per_sqm"])
        for r in regions
        if r.get("avg_price_per_sqm")
    }
    pps = {
        l["condo_id"]: float(l["price_per_sqm"])
        for l in listings
        if l.get("price_per_sqm")
    }

    upserts: list[dict] = []
    implausible = 0
    for c in condos:
        rpps = region_avg.get(c.get("region_id"))
        cpps = pps.get(c["id"])
        if not (rpps and cpps and rpps > 0):
            continue
        bi = round(cpps / rpps * 100, 2)
        # value_scores.bubble_index is numeric(6,2), so anything >= 10^4
        # aborts the whole batch with 22003 numeric field overflow — which is
        # exactly what happened the first time this function was allowed to
        # see past row 1000. But the cap is not really the point: a building
        # priced at 25x its district average is a parse error (a total price
        # stored in a per-sqm field, a rent row that slipped through), not a
        # signal, and publishing "priced 6,300% above district average" on a
        # condo page would be worse than publishing nothing. Skip and count.
        if not (BI_FLOOR <= bi <= BI_CEILING):
            implausible += 1
            continue
        upserts.append({"condo_id": c["id"], "bubble_index": bi})

    for i in range(0, len(upserts), 500):
        client.table("value_scores").upsert(
            upserts[i:i + 500], on_conflict="condo_id", returning="minimal"
        ).execute()
    logger.info(
        f"bubble_index computed for {len(upserts)} condos "
        f"({implausible} skipped as implausible outliers)"
    )
    return len(upserts)
