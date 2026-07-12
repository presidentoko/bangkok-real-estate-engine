"""Final value rollup: asset_value_score + Super Value flag (top 5%).

asset_value_score = clamp(200 - bubble_index, 0, 200) / 2  → 0..100
                    (100 means listing pps is half of regional avg)

A condo is Super Value if its asset_rank_pct AND livability_rank_pct
both sit in the top `top_pct`% of the active set, AFTER subtracting
risk_penalty from livability.
"""
from __future__ import annotations

from loguru import logger
from supabase import Client


def _percentile_rank(values: list[float], v: float) -> float:
    if not values:
        return 0.0
    n = sum(1 for x in values if x <= v)
    return round(n / len(values) * 100, 2)


def _fetch_all(supabase: Client, table: str, order_by: str = "condo_id") -> list[dict]:
    """Paginate a select("*") — PostgREST caps every response at 1000 rows
    regardless of .limit(). Ordering by the PK (condo_id for value_scores/
    livability_metrics/risk_factors) is required: without ORDER BY, Postgres
    doesn't guarantee stable row order across separate .range() requests, so
    pages can skip or duplicate rows."""
    out: list[dict] = []
    offset = 0
    while True:
        chunk = (
            supabase.table(table)
            .select("*")
            .order(order_by)
            .range(offset, offset + 999)
            .execute()
            .data
        ) or []
        out.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return out


def compute_super_value(supabase: Client, top_pct: float = 5.0) -> int:
    scores = _fetch_all(supabase, "value_scores")
    livs = {r["condo_id"]: r for r in _fetch_all(supabase, "livability_metrics")}
    risks = {r["condo_id"]: r for r in _fetch_all(supabase, "risk_factors")}

    enriched: list[dict] = []
    for s in scores:
        bi = float(s.get("bubble_index") or 0)
        if not bi:
            continue
        asset = max(0.0, min(100.0, (200 - bi) / 2))
        liv_raw = livs.get(s["condo_id"], {}).get("livability_score")
        risk = float(risks.get(s["condo_id"], {}).get("risk_penalty") or 0)
        liv_eff = max(0.0, float(liv_raw) - risk) if liv_raw is not None else None
        enriched.append({
            "condo_id": s["condo_id"],
            "asset": asset,
            "liv": liv_eff,
            "risk": risk,
        })

    asset_vals = [r["asset"] for r in enriched]
    liv_vals = [r["liv"] for r in enriched if r["liv"] is not None]
    threshold = 100 - top_pct

    upserts: list[dict] = []
    super_count = 0
    for r in enriched:
        asset_pct = _percentile_rank(asset_vals, r["asset"])
        liv_pct = _percentile_rank(liv_vals, r["liv"]) if r["liv"] is not None else None
        is_super = (
            liv_pct is not None
            and liv_pct >= threshold
            and asset_pct >= threshold
        )
        if is_super:
            super_count += 1
        upserts.append({
            "condo_id": r["condo_id"],
            "asset_value_score": round(r["asset"], 2),
            "livability_score": r["liv"],
            "risk_penalty": r["risk"],
            "asset_rank_pct": asset_pct,
            "livability_rank_pct": liv_pct,
            "is_super_value": is_super,
        })

    for i in range(0, len(upserts), 500):
        supabase.table("value_scores").upsert(
            upserts[i:i + 500], on_conflict="condo_id", returning="minimal"
        ).execute()
    logger.info(
        f"super_value: {super_count}/{len(upserts)} flagged (top {top_pct}% on both axes)"
    )
    return super_count
