"""Bubble Index = listing_pps / region_avg_pps × 100.

> 100 = priced above regional average ("bubble" suspicion).
< 100 = priced below regional average ("undervalued" candidate).
"""
from __future__ import annotations

from loguru import logger
from supabase import Client


def compute_bubble_indices(client: Client) -> int:
    """Compute and upsert bubble_index for every active condo. Returns count."""
    client.rpc("recompute_region_averages", {}).execute()

    condos = (
        client.table("condos")
        .select("id, region_id")
        .eq("is_active", True)
        .execute().data
    )
    listings = (
        client.table("v_latest_listings")
        .select("condo_id, price_per_sqm")
        .execute().data
    )
    regions = (
        client.table("regions")
        .select("id, avg_price_per_sqm")
        .execute().data
    )

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
    for c in condos:
        rpps = region_avg.get(c.get("region_id"))
        cpps = pps.get(c["id"])
        if not (rpps and cpps and rpps > 0):
            continue
        upserts.append({
            "condo_id": c["id"],
            "bubble_index": round(cpps / rpps * 100, 2),
        })

    for i in range(0, len(upserts), 500):
        client.table("value_scores").upsert(
            upserts[i:i + 500], on_conflict="condo_id"
        ).execute()
    logger.info(f"bubble_index computed for {len(upserts)} condos")
    return len(upserts)
