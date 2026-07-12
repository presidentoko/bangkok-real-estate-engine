"""Per-condo strength/weakness summary for developer outreach (Sansiri, AP, etc.)."""
from __future__ import annotations

from datetime import datetime, timezone

from loguru import logger
from supabase import Client


def _summarise(condo: dict, score: dict, liv: dict | None, risk: dict | None) -> dict:
    strengths: list[str] = []
    weaknesses: list[str] = []

    bi = float(score.get("bubble_index") or 0)
    if bi and bi < 90:
        strengths.append(
            f"Priced {round(100 - bi, 1)}% below regional average (Bubble Index {bi})"
        )
    elif bi > 115:
        weaknesses.append(
            f"Priced {round(bi - 100, 1)}% above regional average (Bubble Index {bi})"
        )

    if liv:
        bts = liv.get("nearest_bts_distance_m")
        mrt = liv.get("nearest_mrt_distance_m")
        nearby = [d for d in (bts, mrt) if d is not None]
        closest = min(nearby) if nearby else None
        if closest is not None and closest <= 500:
            strengths.append(f"Walking distance to transit ({closest} m)")
        elif closest is not None and closest > 1200:
            weaknesses.append(f"Far from BTS/MRT (~{closest} m)")
        for k, label in (
            ("hospitals_within_1km", "hospitals"),
            ("schools_within_1km", "schools"),
            ("supermarkets_within_1km", "supermarkets"),
        ):
            v = liv.get(k) or 0
            if v >= 5:
                strengths.append(f"Dense {label} cluster ({v} within 1 km)")
            elif v == 0:
                weaknesses.append(f"No {label} within 1 km")

    if risk:
        if (risk.get("flood_risk_level") or 0) >= 3:
            weaknesses.append(
                f"Elevated monsoon flood risk (level {risk['flood_risk_level']}/5)"
            )
        if risk.get("active_construction_within_500m"):
            weaknesses.append(
                f"{risk.get('construction_count', 0)} active construction site(s) within 500 m"
            )

    rec = (
        "Position as 'undervalued + livable' to investor-occupier blend; "
        "highlight regional benchmark delta in marketing collateral."
        if score.get("is_super_value")
        else "Differentiate on amenities / unit mix, or revisit pricing vs. regional benchmark."
    )
    return {
        "condo_id": condo["id"],
        "developer": condo.get("developer"),
        "summary_strengths": strengths,
        "summary_weaknesses": weaknesses,
        "recommendations": rec,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _fetch_all(supabase: Client, table: str, order_by: str = "condo_id", **filters) -> list[dict]:
    """Paginate a select("*") — PostgREST caps every response at 1000 rows
    regardless of table size. Ordering by the PK is required: without ORDER
    BY, Postgres doesn't guarantee stable row order across separate
    .range() requests, so pages can skip or duplicate rows. (Same pattern
    as src/analysis/super_value.py's _fetch_all / scripts/compute_value_scores.py's.)
    """
    out: list[dict] = []
    offset = 0
    while True:
        q = supabase.table(table).select("*")
        for k, v in filters.items():
            q = q.eq(k, v)
        chunk = q.order(order_by).range(offset, offset + 999).execute().data or []
        out.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return out


def generate_reports(supabase: Client) -> int:
    # condos.id / value_scores.condo_id / livability_metrics.condo_id /
    # risk_factors.condo_id are each that table's PK (see db/schema.sql).
    condos = _fetch_all(supabase, "condos", order_by="id", is_active=True)
    scores = {r["condo_id"]: r for r in _fetch_all(supabase, "value_scores")}
    livs = {r["condo_id"]: r for r in _fetch_all(supabase, "livability_metrics")}
    risks = {r["condo_id"]: r for r in _fetch_all(supabase, "risk_factors")}

    payloads: list[dict] = []
    for c in condos:
        s = scores.get(c["id"])
        if not s:
            continue
        payloads.append(_summarise(c, s, livs.get(c["id"]), risks.get(c["id"])))

    condo_ids = [p["condo_id"] for p in payloads]
    for i in range(0, len(condo_ids), 200):
        supabase.table("developer_reports").delete().in_(
            "condo_id", condo_ids[i:i + 200]
        ).execute()
    for i in range(0, len(payloads), 200):
        supabase.table("developer_reports").insert(
            payloads[i:i + 200], returning="minimal"
        ).execute()
    logger.info(f"developer_reports: {len(payloads)} generated")
    return len(payloads)
