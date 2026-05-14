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


def generate_reports(supabase: Client) -> int:
    condos = supabase.table("condos").select("*").eq("is_active", True).execute().data
    scores = {r["condo_id"]: r for r in supabase.table("value_scores").select("*").execute().data}
    livs = {r["condo_id"]: r for r in supabase.table("livability_metrics").select("*").execute().data}
    risks = {r["condo_id"]: r for r in supabase.table("risk_factors").select("*").execute().data}

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
        supabase.table("developer_reports").insert(payloads[i:i + 200]).execute()
    logger.info(f"developer_reports: {len(payloads)} generated")
    return len(payloads)
