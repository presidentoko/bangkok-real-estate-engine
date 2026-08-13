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


def _recompute_region_averages(
    client: Client,
    condos: list[dict],
    pps: dict[str, float],
) -> dict[str, float]:
    """Recompute regions.avg_price_per_sqm in Python, from rows already read.

    This deliberately does NOT call the recompute_region_averages() RPC. That
    function aggregates over v_latest_sale_listings, a distinct-on across
    ~250k `listings` rows, which takes longer than PostgREST's statement
    timeout — calling it over the REST API dies with 57014 canceling
    statement due to statement timeout, and because the function body is one
    transaction the whole recompute rolls back. (The SQL function is still
    the right thing to run from the Supabase SQL editor, where the timeout is
    minutes rather than seconds; migrations 014/015 keep it correct.)

    Doing it here is also the cheaper option on a metered free tier: the
    caller has already paid the egress to read every condo and every latest
    sale listing, so the aggregate costs nothing extra and the only traffic
    is the ~154-row write back.

    Mirrors the SQL definition exactly: active + published condos with a
    region and a sale price_per_sqm. Regions with no qualifying listing are
    cleared to NULL rather than left holding a stale average, since that
    number is a bubble_index denominator.
    """
    sums: dict[str, list[float]] = {}
    for c in condos:
        rid = c.get("region_id")
        if not rid or not c.get("published"):
            continue
        v = pps.get(c["id"])
        if v is not None:
            sums.setdefault(rid, []).append(v)

    region_ids = [r["id"] for r in fetch_all(client, "regions", "id")]
    region_avg: dict[str, float] = {}
    cleared: list[str] = []
    for rid in region_ids:
        vals = sums.get(rid)
        if vals:
            region_avg[rid] = sum(vals) / len(vals)
            client.table("regions").update(
                {"avg_price_per_sqm": round(region_avg[rid], 2), "listing_count": len(vals)},
                returning="minimal",
            ).eq("id", rid).execute()
        else:
            cleared.append(rid)

    for i in range(0, len(cleared), 100):
        client.table("regions").update(
            {"avg_price_per_sqm": None, "listing_count": 0}, returning="minimal"
        ).in_("id", cleared[i:i + 100]).execute()

    logger.info(
        f"region averages: {len(region_avg)} districts priced, {len(cleared)} cleared"
    )
    return region_avg


def compute_bubble_indices(client: Client) -> int:
    """Recompute region averages and bubble_index for every active condo.

    Returns the number of condos scored.
    """
    # All three reads MUST paginate. As plain .select().execute() calls they
    # silently stopped at PostgREST's 1000-row cap, so this function scored
    # 1,297 of 15,785 active condos (8.2%) — every other condo page shipped
    # without the "priced X% above district average" line that is the whole
    # point of the value layer. Found 2026-08-13; see fetch_all's docstring.
    condos = fetch_all(client, "condos", "id, region_id, published", is_active=True)
    # v_latest_sale_listings is one row per condo — condo_id is its stable
    # unique key, so it's the correct ORDER BY for paging.
    listings = fetch_all(
        client, "v_latest_sale_listings", "condo_id, price_per_sqm", order_by="condo_id"
    )

    pps = {
        l["condo_id"]: float(l["price_per_sqm"])
        for l in listings
        if l.get("price_per_sqm")
    }
    region_avg = _recompute_region_averages(client, condos, pps)

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

    # Clear rows this run did NOT score. An upsert only touches the condos it
    # writes, so a condo that drops out of the eligible set — its listings go
    # inactive, its district loses its average, or its ratio is now rejected
    # as implausible — keeps whatever bubble_index it was last given, forever.
    # That is not theoretical: after the rent/sale fix (migration 014) the
    # table still held 1,027 values from the old mixed-source computation,
    # including a 5,755, which the condo pages were happily rendering as
    # "priced 5,655% above district average". Only bubble_index is nulled;
    # the liquidity_* and is_super_value columns on the same row belong to
    # other jobs.
    scored = {u["condo_id"] for u in upserts}
    existing = fetch_all(client, "value_scores", "condo_id, bubble_index", order_by="condo_id")
    stale = [
        r["condo_id"]
        for r in existing
        if r.get("bubble_index") is not None and r["condo_id"] not in scored
    ]
    for i in range(0, len(stale), 200):
        client.table("value_scores").update(
            {"bubble_index": None}, returning="minimal"
        ).in_("condo_id", stale[i:i + 200]).execute()

    logger.info(
        f"bubble_index computed for {len(upserts)} condos "
        f"({implausible} skipped as implausible outliers, {len(stale)} stale cleared)"
    )
    return len(upserts)
