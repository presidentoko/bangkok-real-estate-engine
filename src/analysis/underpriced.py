"""Detect underpriced listings → enqueue alerts.

Trigger:  bubble_index ≤ DEFAULT_BUBBLE_THRESHOLD
Suppress: any condo with an alert in the last ALERT_DEDUP_DAYS days
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from loguru import logger
from supabase import Client

ALERT_DEDUP_DAYS = 7
DEFAULT_BUBBLE_THRESHOLD = 80.0  # ≥20% below district average

# Chunk size for .in_(id_list) filters — bounds both the PostgREST 1000-row
# response cap and URL length as the underpriced set grows past today's
# ~396 ids. Matches src/analysis/price_movers.py's _hydrate_condos chunking.
IN_CHUNK = 200


def detect_underpriced(
    supabase: Client,
    threshold: float = DEFAULT_BUBBLE_THRESHOLD,
) -> int:
    scores: list[dict] = []
    offset = 0
    while True:
        chunk = (
            supabase.table("value_scores")
            .select("condo_id, bubble_index")
            .lte("bubble_index", threshold)
            .order("condo_id")
            .range(offset, offset + 999)
            .execute().data
        ) or []
        scores.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    if not scores:
        logger.info("underpriced: no condos under threshold")
        return 0

    condo_ids = [s["condo_id"] for s in scores]
    score_map = {s["condo_id"]: float(s["bubble_index"]) for s in scores}

    # Chunk every .in_(condo_ids) lookup — condo_ids can exceed 1000 (the
    # PostgREST per-response row cap) or blow past URL-length limits as the
    # underpriced set grows. Same idiom as price_movers._hydrate_condos.
    condo_map: dict[str, dict] = {}
    for i in range(0, len(condo_ids), IN_CHUNK):
        chunk = condo_ids[i:i + IN_CHUNK]
        rows = (
            supabase.table("condos")
            .select("id, name, region_id")
            .in_("id", chunk)
            .execute().data
        ) or []
        for c in rows:
            condo_map[c["id"]] = c

    region_rows = (
        supabase.table("regions")
        .select("id, name, avg_price_per_sqm")
        .execute().data
    )
    region_map = {r["id"]: r for r in region_rows}

    listing_map: dict[str, dict] = {}
    for i in range(0, len(condo_ids), IN_CHUNK):
        chunk = condo_ids[i:i + IN_CHUNK]
        rows = (
            supabase.table("v_latest_listings")
            .select("condo_id, listing_id, price, price_per_sqm")
            .in_("condo_id", chunk)
            .execute().data
        ) or []
        for l in rows:
            listing_map[l["condo_id"]] = l

    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=ALERT_DEDUP_DAYS)
    ).isoformat()
    recent_ids: set[str] = set()
    for i in range(0, len(condo_ids), IN_CHUNK):
        chunk = condo_ids[i:i + IN_CHUNK]
        rows = (
            supabase.table("underpriced_alerts")
            .select("condo_id")
            .gte("detected_at", cutoff)
            .in_("condo_id", chunk)
            .execute().data
        ) or []
        recent_ids.update(r["condo_id"] for r in rows)

    new_alerts: list[dict] = []
    for cid in condo_ids:
        if cid in recent_ids:
            continue
        c = condo_map.get(cid)
        l = listing_map.get(cid)
        if not (c and l):
            continue
        region = region_map.get(c.get("region_id")) or {}
        new_alerts.append({
            "condo_id": cid,
            "listing_id": l.get("listing_id"),
            "bubble_index": score_map[cid],
            "region_name": region.get("name"),
            "price": l.get("price"),
            "price_per_sqm": l.get("price_per_sqm"),
            "region_avg_pps": region.get("avg_price_per_sqm"),
        })

    for i in range(0, len(new_alerts), 200):
        supabase.table("underpriced_alerts").insert(
            new_alerts[i:i + 200], returning="minimal"
        ).execute()

    logger.info(
        f"underpriced: {len(new_alerts)} new alerts "
        f"({len(recent_ids)} suppressed as ≤{ALERT_DEDUP_DAYS}d dupes)"
    )
    return len(new_alerts)
