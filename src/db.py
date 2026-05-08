"""Supabase client + persistence helpers.

upsert_condo() normalises free-text 'region' to a canonical Bangkok district
(via src.util.district.extract_district) so regional averages aggregate at a
meaningful unit instead of fragmenting across every soi/landmark string.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from loguru import logger
from supabase import Client, create_client

from src.config import get_settings
from src.util.district import extract_district


def get_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


def upsert_region(
    client: Client,
    name: str,
    name_th: str | None = None,
    province: str = "bangkok",
) -> str:
    payload: dict[str, Any] = {"name": name, "name_th": name_th, "province": province}
    # Drop None values so we don't overwrite existing name_th with NULL on re-upsert.
    payload = {k: v for k, v in payload.items() if v is not None}
    res = (
        client.table("regions")
        .upsert(payload, on_conflict="name")
        .execute()
    )
    if res.data:
        return res.data[0]["id"]
    found = client.table("regions").select("id").eq("name", name).limit(1).execute()
    return found.data[0]["id"]


def _resolve_region(condo: dict[str, Any]) -> str | None:
    """Pick the best canonical district from raw scraper fields."""
    candidates = [
        condo.get("region"),
        condo.get("address"),
        condo.get("name"),
    ]
    for txt in candidates:
        d = extract_district(txt)
        if d:
            return d
    # If we got *some* region text but couldn't normalise, keep the raw text
    # so we don't silently drop it from regional aggregation.
    return (condo.get("region") or "").strip() or None


def upsert_condo(client: Client, condo: dict[str, Any]) -> str:
    """Upsert condo by (source, source_listing_id); returns id."""
    canonical = _resolve_region(condo)
    province = (condo.get("province") or "bangkok").strip().lower()
    region_id = upsert_region(client, canonical, province=province) if canonical else None

    payload = {
        "source": condo["source"],
        "source_listing_id": condo["source_listing_id"],
        "name": condo["name"],
        "region_id": region_id,
        "province": province,
        "address": condo.get("address"),
        "latitude": condo.get("latitude"),
        "longitude": condo.get("longitude"),
        "completion_year": condo.get("completion_year"),
        "developer": condo.get("developer"),
        "url": condo.get("url"),
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }
    # New non-bangkok provinces start unpublished so the site doesn't expose
    # them until we explicitly launch (UPDATE condos SET published=true...).
    if province != "bangkok":
        payload["published"] = False
    # Only set property_type when the scraper supplied one — older callers
    # rely on the column default ('condo') and we don't want to clobber it.
    if condo.get("property_type"):
        payload["property_type"] = condo["property_type"]
    res = (
        client.table("condos")
        .upsert(payload, on_conflict="source,source_listing_id")
        .execute()
    )
    if res.data:
        return res.data[0]["id"]
    found = (
        client.table("condos")
        .select("id")
        .eq("source", condo["source"])
        .eq("source_listing_id", condo["source_listing_id"])
        .limit(1)
        .execute()
    )
    return found.data[0]["id"]


def persist_detail(client: Client, condo_id: str, detail: dict[str, Any]) -> None:
    """Apply Phase 2 Tier A enrichment to an existing condo row.

    Updates condos columns (lat/lng, amenities count fields, etc) and replaces
    the condo's amenity + transit rows with what the parser produced.
    Idempotent — safe to re-run on the same condo.
    """
    payload: dict[str, Any] = {
        "address": detail.get("address"),
        "latitude": detail.get("latitude"),
        "longitude": detail.get("longitude"),
        "completion_year": detail.get("completion_year"),
        "floors": detail.get("floors"),
        "total_units": detail.get("total_units"),
        "available_units_count": detail.get("available_units_count"),
        "price_min": detail.get("price_min"),
        "price_max": detail.get("price_max"),
        "price_currency": detail.get("price_currency"),
        "price_period": detail.get("price_period"),
        "description": detail.get("description"),
        "hero_image_url": detail.get("hero_image_url"),
        "detail_fetched_at": datetime.now(timezone.utc).isoformat(),
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }
    # Drop None to avoid clobbering existing values with NULL.
    payload = {k: v for k, v in payload.items() if v is not None}
    client.table("condos").update(payload).eq("id", condo_id).execute()

    # Replace amenities (delete + insert) — small set per building, safe.
    client.table("condo_amenities").delete().eq("condo_id", condo_id).execute()
    amenities = detail.get("amenities") or []
    if amenities:
        client.table("condo_amenities").insert(
            [{"condo_id": condo_id, "name": a} for a in amenities]
        ).execute()

    # Same for transit (BTS/MRT mentioned in FAQ).
    client.table("condo_transit").delete().eq("condo_id", condo_id).execute()
    transit = detail.get("transit") or []
    if transit:
        client.table("condo_transit").insert(
            [{"condo_id": condo_id, "line": t["line"], "station": t["station"]}
             for t in transit]
        ).execute()


def _parse_year_month(label: str | None) -> str | None:
    """'Apr 25' → '2025-04-01' (ISO date). None on failure."""
    if not label:
        return None
    from datetime import datetime
    for fmt in ("%b %y", "%B %y", "%b %Y", "%B %Y"):
        try:
            return datetime.strptime(label.strip(), fmt).strftime("%Y-%m-01")
        except ValueError:
            continue
    return None


def persist_detail_b(client: Client, condo_id: str, detail: dict[str, Any]) -> dict[str, int]:
    """Apply Tier B enrichment to an existing condo row.

    Updates condos market summary columns, replaces amenity/neighbour/parking-fact
    rows, appends chart series, and upserts listings.

    Returns counts of rows touched per table for logging.
    """
    tier_b = detail.get("tier_b") or {}
    facilities = tier_b.get("facilities") or []
    units = tier_b.get("units") or []
    parking = tier_b.get("parking_and_lifts") or []
    market = tier_b.get("market_summary") or []
    charts = tier_b.get("price_charts") or []
    neighbours = tier_b.get("neighbours") or []

    # --- condo market summary columns
    market_cols: dict[str, Any] = {
        "tier_b_fetched_at": datetime.now(timezone.utc).isoformat(),
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }
    summary_currency = None
    for m in market:
        if m.get("period") == "rent":
            market_cols["market_rent_median"] = m.get("median_price")
            market_cols["market_rent_per_sqm"] = m.get("median_per_sqm")
            market_cols["market_rent_yoy_pct"] = m.get("yoy_pct")
        elif m.get("period") == "sale":
            market_cols["market_sale_median"] = m.get("median_price")
            market_cols["market_sale_per_sqm"] = m.get("median_per_sqm")
            market_cols["market_sale_yoy_pct"] = m.get("yoy_pct")
        if m.get("currency"):
            summary_currency = m["currency"]
    if summary_currency:
        market_cols["market_summary_currency"] = summary_currency
        market_cols["market_summary_updated_at"] = datetime.now(timezone.utc).isoformat()
    market_cols = {k: v for k, v in market_cols.items() if v is not None}
    client.table("condos").update(market_cols).eq("id", condo_id).execute()

    # --- facilities OVERRIDE Tier A amenities (Tier B has richer set)
    if facilities:
        client.table("condo_amenities").delete().eq("condo_id", condo_id).execute()
        client.table("condo_amenities").insert(
            [{"condo_id": condo_id, "name": f} for f in facilities]
        ).execute()

    # --- parking facts (replace)
    client.table("condo_parking_facts").delete().eq("condo_id", condo_id).execute()
    if parking:
        client.table("condo_parking_facts").insert(
            [{"condo_id": condo_id, "fact_key": p["key"], "fact_value": p.get("value")}
             for p in parking if p.get("key")]
        ).execute()

    # --- neighbours (replace)
    client.table("condo_neighbours").delete().eq("condo_id", condo_id).execute()
    if neighbours:
        client.table("condo_neighbours").insert(
            [{"condo_id": condo_id,
              "neighbour_slug": n["slug"],
              "neighbour_url": n["url"],
              "neighbour_name": n.get("name")}
             for n in neighbours]
        ).execute()

    # --- chart series (append; uniqueness includes captured_at so re-runs
    #     create a new snapshot rather than colliding)
    captured_at = datetime.now(timezone.utc).isoformat()
    chart_rows: list[dict] = []
    for c in charts:
        period = c.get("period")
        metric = c.get("metric")
        currency = c.get("currency")
        if period not in ("rent", "sale") or metric not in ("price", "per_sqm"):
            continue
        for p in c.get("points") or []:
            ym = _parse_year_month(p.get("date"))
            if not ym:
                continue
            chart_rows.append({
                "condo_id": condo_id,
                "period": period,
                "metric": metric,
                "currency": currency,
                "year_month": ym,
                "value": p.get("value"),
                "captured_at": captured_at,
            })
    if chart_rows:
        # insert in chunks of 200 to stay under PostgREST limits
        for i in range(0, len(chart_rows), 200):
            client.table("condo_market_chart").insert(chart_rows[i:i+200]).execute()

    # --- listings (upsert per unit)
    listing_rows: list[dict] = []
    for u in units:
        if not u.get("source_unit_id"):
            continue
        # listings.price is NOT NULL — skip units without parsed price
        if u.get("price") is None:
            continue
        listing_rows.append({
            "condo_id": condo_id,
            "source": "hipflat",
            "source_unit_id": u["source_unit_id"],
            "listing_type": u["listing_type"],
            "price": u["price"],
            "currency": u.get("price_currency") or "THB",
            "area_sqm": u.get("size_sqm"),
            "bedrooms": u.get("bedrooms"),
            "bathrooms": u.get("bathrooms"),
            "floor_level": u.get("floor_level"),
            "publisher": u.get("publisher"),
            "listing_url": u.get("listing_url"),
        })
    if listing_rows:
        # Hipflat's rent + sale tabs occasionally share the same source_unit_id
        # (cross-listed by the publisher). Our unique index doesn't include
        # listing_type, so dedupe by source_unit_id; keep the first occurrence.
        seen_ids: set[str] = set()
        deduped: list[dict] = []
        for r in listing_rows:
            sid = r["source_unit_id"]
            if sid in seen_ids:
                continue
            seen_ids.add(sid)
            deduped.append(r)

        # PostgREST ON CONFLICT can't reference our PARTIAL unique index, so
        # use the same delete-then-insert idiom as amenities/transit. Listings
        # are a current-snapshot view in this pipeline; price_history is the
        # time-series store.
        client.table("listings").delete().eq("condo_id", condo_id).eq(
            "source", "hipflat"
        ).execute()
        for i in range(0, len(deduped), 200):
            client.table("listings").insert(deduped[i:i+200]).execute()
        listing_rows = deduped  # so the returned count reflects what was written

    return {
        "facilities": len(facilities),
        "parking_facts": len(parking),
        "neighbours": len(neighbours),
        "chart_rows": len(chart_rows),
        "listings": len(listing_rows),
    }


def insert_listing(client: Client, condo_id: str, listing: dict[str, Any]) -> None:
    client.table("listings").insert({
        "condo_id": condo_id,
        "listing_type": listing.get("listing_type", "sale"),
        "price": listing["price"],
        "currency": listing.get("currency", "THB"),
        "area_sqm": listing.get("area_sqm"),
        "bedrooms": listing.get("bedrooms"),
        "bathrooms": listing.get("bathrooms"),
        "floor_level": listing.get("floor_level"),
    }).execute()


def append_price_history(client: Client, condo_id: str, listing: dict[str, Any]) -> None:
    listing_type = listing.get("listing_type", "sale")
    prev = (
        client.table("price_history")
        .select("price")
        .eq("condo_id", condo_id)
        .eq("listing_type", listing_type)
        .order("captured_at", desc=True)
        .limit(1)
        .execute()
    )
    delta_pct = None
    if prev.data:
        prev_price = float(prev.data[0]["price"])
        if prev_price > 0:
            delta_pct = round((listing["price"] - prev_price) / prev_price * 100, 2)
    pps = (
        round(listing["price"] / listing["area_sqm"], 2)
        if listing.get("area_sqm") and listing["area_sqm"] > 0
        else None
    )
    client.table("price_history").insert({
        "condo_id": condo_id,
        "listing_type": listing_type,
        "price": listing["price"],
        "price_per_sqm": pps,
        "delta_pct": delta_pct,
    }).execute()


def recompute_region_averages(client: Client) -> None:
    client.rpc("recompute_region_averages", {}).execute()
    logger.info("Region averages recomputed via RPC")
