"""Resale Liquidity Score — how easily a unit in this building can be re-sold.

No portal answers the investor's real fear: "if I buy here, can I get my money
back out?" We can, because we track every hipflat listing's first_seen_at and
flip is_active=false the moment it disappears from the portal (see src/db.py).
That gives us, per building:

  * absorbed listings — went inactive within the trailing window; their
    (last_seen_at - first_seen_at) is the real time-to-clear (sold or withdrawn).
  * active listings   — still up; their (now - first_seen_at) is how long the
    current unsold inventory has been sitting.

Score is 0-100 (higher = more liquid), a weighted blend of:
  S1 absorption rate (0.40) — share of recent supply that actually cleared
  S2 clear speed     (0.35) — how fast absorbed listings left the market
  S3 freshness       (0.25) — penalty for active inventory sitting a long time

Buildings with too few observed listings get score=None — we'd rather show
"not enough data" than a misleading number. The signal sharpens over time as
more listings cycle through.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from loguru import logger
from supabase import Client

# Sub-signal weights. Absorption (did stock actually clear?) is the most honest
# liquidity proof, so it carries the most weight; freshness is a soft penalty.
W_ABSORB = 0.40
W_SPEED = 0.35
W_FRESH = 0.25

# Below this many observed listings the score is statistically meaningless.
MIN_OBS = 4
# Only count listings that disappeared within this trailing window as "absorbed";
# older departures say nothing about today's liquidity.
WINDOW_DAYS = 120


def _median(xs: list[float]) -> float | None:
    s = sorted(xs)
    n = len(s)
    if n == 0:
        return None
    m = n // 2
    if n % 2:
        return float(s[m])
    return (s[m - 1] + s[m]) / 2.0


def _decay(days: float, fast: float = 30.0, slow: float = 365.0) -> float:
    """100 at <=fast days, ~0 at >=slow days, linear in between. Used to turn a
    'days' figure into a 0-100 'how good' sub-score where faster = better."""
    if days <= fast:
        return 100.0
    if days >= slow:
        return 0.0
    return round(100.0 * (slow - days) / (slow - fast), 2)


def _grade(score: float) -> str:
    if score >= 75:
        return "high"
    if score >= 55:
        return "good"
    if score >= 35:
        return "moderate"
    if score >= 20:
        return "slow"
    return "illiquid"


def score_liquidity(
    active_doms: list[float],
    absorbed_doms: list[float],
    *,
    min_obs: int = MIN_OBS,
) -> dict:
    """Pure scoring core (no DB) so it can be unit-tested.

    active_doms:   current days-on-market for still-listed units.
    absorbed_doms: time-to-clear (days) for units that left the market in-window.

    Returns {score, grade, sample_size, absorption_rate, median_sold_dom}.
    score/grade/etc are None when there is not enough data to judge.
    """
    active = [float(d) for d in active_doms if d is not None and d >= 0]
    absorbed = [float(d) for d in absorbed_doms if d is not None and d >= 0]
    n_active = len(active)
    n_absorbed = len(absorbed)
    n_obs = n_active + n_absorbed

    if n_obs < min_obs:
        return {
            "score": None,
            "grade": "insufficient_data",
            "sample_size": n_obs,
            "absorption_rate": None,
            "median_sold_dom": None,
        }

    # S1 — absorption rate: of all supply we observed in-window, how much cleared.
    absorption_rate = n_absorbed / n_obs  # 0..1
    s1 = absorption_rate * 100.0

    # S2 — clear speed from how long absorbed listings took to leave.
    med_sold = _median(absorbed)
    if med_sold is not None:
        s2 = _decay(med_sold)
    else:
        # Nothing has cleared yet: infer from how long active stock has sat, but
        # haircut it — sitting inventory is not proof that anything actually sells.
        med_active_for_s2 = _median(active) or 0.0
        s2 = _decay(med_active_for_s2) * 0.5

    # S3 — freshness: long-sitting active inventory drags liquidity down.
    med_active = _median(active)
    s3 = _decay(med_active) if med_active is not None else 100.0

    score = round(W_ABSORB * s1 + W_SPEED * s2 + W_FRESH * s3, 1)
    score = max(0.0, min(100.0, score))

    return {
        "score": score,
        "grade": _grade(score),
        "sample_size": n_obs,
        "absorption_rate": round(absorption_rate * 100, 1),
        "median_sold_dom": int(round(med_sold)) if med_sold is not None else None,
    }


def _parse(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def compute_liquidity_scores(client: Client, window_days: int = WINDOW_DAYS) -> int:
    """Compute and upsert liquidity_score for every condo with enough hipflat
    listing history. Returns the number of condos scored."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=window_days)

    logger.info("Loading hipflat listings (all pages)...")
    rows: list[dict] = []
    offset = 0
    while True:
        chunk = (
            client.table("listings")
            .select("condo_id, is_active, first_seen_at, last_seen_at")
            .eq("source", "hipflat")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
        ) or []
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    logger.info(f"  loaded {len(rows)} listings")

    by_condo: dict[str, dict[str, list[float]]] = defaultdict(
        lambda: {"active": [], "absorbed": []}
    )
    for r in rows:
        cid = r.get("condo_id")
        first = _parse(r.get("first_seen_at"))
        if not cid or first is None:
            continue
        if r.get("is_active"):
            dom = (now - first).total_seconds() / 86400
            if dom >= 0:
                by_condo[cid]["active"].append(dom)
        else:
            last = _parse(r.get("last_seen_at"))
            if last is None or last < cutoff:
                continue  # left the market too long ago to inform today's liquidity
            dom = (last - first).total_seconds() / 86400
            if dom >= 0:
                by_condo[cid]["absorbed"].append(dom)

    now_iso = now.isoformat()
    upserts: list[dict] = []
    for cid, d in by_condo.items():
        res = score_liquidity(d["active"], d["absorbed"])
        if res["score"] is None:
            continue
        upserts.append({
            "condo_id": cid,
            "liquidity_score": res["score"],
            "liquidity_grade": res["grade"],
            "liquidity_absorption_rate": res["absorption_rate"],
            "liquidity_median_sold_dom": res["median_sold_dom"],
            "liquidity_sample_size": res["sample_size"],
            "liquidity_computed_at": now_iso,
        })

    for i in range(0, len(upserts), 500):
        client.table("value_scores").upsert(
            upserts[i:i + 500], on_conflict="condo_id", returning="minimal"
        ).execute()
    logger.info(
        f"liquidity scored for {len(upserts)} condos "
        f"(of {len(by_condo)} with hipflat listings)"
    )
    return len(upserts)
