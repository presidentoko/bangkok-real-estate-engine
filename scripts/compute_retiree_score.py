# scripts/compute_retiree_score.py
"""Compute retiree_score (0-100) for every condo that has livability_metrics.

Ports the same formula as web/lib/retiree.ts — identical weights and breakpoints.

Usage:
    python scripts/compute_retiree_score.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.db import get_client  # noqa: E402

_W = {"healthcare": 0.4, "air": 0.25, "transit": 0.2, "errands": 0.15}


def _healthcare(hospitals: int) -> float:
    if hospitals <= 0: return 10.0
    if hospitals == 1: return 55.0
    if hospitals == 2: return 75.0
    if hospitals == 3: return 88.0
    return 100.0


def _air(aqi: int) -> float:
    if aqi <= 25:  return 100.0
    if aqi <= 50:  return 85.0
    if aqi <= 75:  return 65.0
    if aqi <= 100: return 45.0
    if aqi <= 150: return 25.0
    return 8.0


def _transit(metres: float | None) -> float:
    if metres is None: return 20.0
    if metres <= 300:  return 100.0
    if metres <= 500:  return 85.0
    if metres <= 800:  return 65.0
    if metres <= 1200: return 40.0
    return 15.0


def _errands(supermarkets: int | None) -> float:
    n = supermarkets or 0
    if n <= 0: return 15.0
    if n == 1: return 55.0
    if n == 2: return 75.0
    return 95.0


def compute_score(
    hospitals: int | None,
    aqi: int | None,
    nearest_bts_m: float | None,
    nearest_mrt_m: float | None,
    supermarkets: int | None,
) -> float | None:
    """Return retiree suitability 0-100, or None if livability data is missing."""
    if hospitals is None:
        return None

    healthcare = _healthcare(hospitals)
    candidates = [v for v in (nearest_bts_m, nearest_mrt_m) if v is not None]
    transit = _transit(min(candidates) if candidates else None)
    errands = _errands(supermarkets)
    has_air = aqi is not None
    air = _air(aqi) if has_air else 0.0

    if has_air:
        score = (
            _W["healthcare"] * healthcare
            + _W["air"] * air
            + _W["transit"] * transit
            + _W["errands"] * errands
        )
    else:
        denom = _W["healthcare"] + _W["transit"] + _W["errands"]
        score = (
            _W["healthcare"] * healthcare
            + _W["transit"] * transit
            + _W["errands"] * errands
        ) / denom

    return round(max(0.0, min(100.0, score)) * 10) / 10


def main() -> int:
    db = get_client()

    PAGE = 1000
    offset = 0
    rows: list[dict] = []
    while True:
        resp = (
            db.from_("condos")
            .select(
                "id, aqi_score, retiree_score, "
                "livability_metrics(hospitals_within_1km, supermarkets_within_1km, "
                "nearest_bts_distance_m, nearest_mrt_distance_m)"
            )
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    print(f"fetched {len(rows)} condos from DB")
    now = datetime.now(timezone.utc).isoformat()
    updates: list[dict] = []
    unchanged = 0

    for row in rows:
        lm = row.get("livability_metrics")
        if isinstance(lm, list):
            lm = lm[0] if lm else None
        if not lm:
            continue
        score = compute_score(
            hospitals=lm.get("hospitals_within_1km"),
            aqi=row.get("aqi_score"),
            nearest_bts_m=lm.get("nearest_bts_distance_m"),
            nearest_mrt_m=lm.get("nearest_mrt_distance_m"),
            supermarkets=lm.get("supermarkets_within_1km"),
        )
        if score is None:
            continue
        # Skip the write when the score hasn't moved. Inputs like hospital
        # counts and transit distance rarely change once set, so most rows
        # are no-ops after the first run. aqi_score can still update
        # independently (see ingest_pm25.py) — we recompute every row above,
        # we just don't issue a write when the result is identical.
        if row.get("retiree_score") == score:
            unchanged += 1
            continue
        updates.append({
            "id": row["id"],
            "retiree_score": score,
            "retiree_score_computed_at": now,
        })

    print(f"  {unchanged} unchanged (skipped), {len(updates)} to update")

    if not updates:
        print("no condos with livability data — nothing to update")
        return 0

    RECONNECT_EVERY = 500
    for i, u in enumerate(updates, 1):
        if i % RECONNECT_EVERY == 1:
            db = get_client()
        db.from_("condos").update({
            "retiree_score": u["retiree_score"],
            "retiree_score_computed_at": u["retiree_score_computed_at"],
        }).eq("id", u["id"]).execute()
        if i % RECONNECT_EVERY == 0:
            print(f"  updated {i}/{len(updates)}")

    good_plus = sum(1 for u in updates if u["retiree_score"] >= 55)
    print(f"retiree_score computed for {len(updates)} condos ({good_plus} scored >= 55 / good+)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
