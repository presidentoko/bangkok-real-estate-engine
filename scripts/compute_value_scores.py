"""Compute bubble_index per building from listings, for every source.

bubble_index = building median sale price/m2 / baseline median price/m2 x 100
(100 = at the local median, >100 = premium, <100 = discount).

Why this changed (data audit 2026-11-17, H6)
-------------------------------------------
This script used to score hipflat buildings only, in USD, against hipflat-only
district medians. The other ~5,000 rows in value_scores (fazwaz, ddproperty,
dotproperty) were left from a 2026-08-13 run of src/analysis/bubble_index.py,
which averaged USD and THB price/m2 into one regional mean. Outside Bangkok
that pushed the per-city median bubble to 23 (Pattaya), 31 (Samui) and 50
(Phuket) where by construction it should sit near 100.

Now, in one pass:
1. Every active SALE listing, any source, converted to THB/m2 (USD x
   --thb-per-usd). Rows over 300 m2 or under 15 m2 (whole floors, sqft areas
   stored as m2) and price/m2 outside 10k-600k THB are dropped, the same
   kind of plausibility gate compute_yields.py applies.
2. Building median THB/m2 (one vote per building).
3. Baseline = the median over buildings in the same district (region_id),
   when the district has MIN_BUILDINGS; outside Bangkok, otherwise the median
   over the building's province (so a city's buildings centre on 100 too);
   otherwise no score. A Bangkok building with no district is not scored:
   against the citywide median a central tower reads as a "bubble".
3b. Buildings with no active sale listing that can be priced today (fazwaz
   has none active; dotproperty sale rows carry no area) keep their stored
   score only re-based: divided by the median stored score of the same
   district (or, outside Bangkok, province) and x100. The stored score is
   building/regional-mean, so this recovers building/district-median on the
   data it was computed from, without the mixed-currency mean.
4. Scores outside [BI_FLOOR, BI_CEILING] are not published (null): past
   that range it is a data-quality artifact, not a premium.
5. value_scores rows that get no score this run have bubble_index set to
   null instead of keeping a stale value from another baseline.
regions.avg_price_per_sqm is written as the district median, in THB.

Usage:
  python scripts/compute_value_scores.py
  python scripts/compute_value_scores.py --dry-run
  python scripts/compute_value_scores.py --backup data/backups/value_scores_x.csv
"""
from __future__ import annotations

import argparse
import csv
import statistics
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger  # noqa: E402

PAGE = 1000
MIN_BUILDINGS = 5          # buildings with a price needed for a baseline
BI_FLOOR, BI_CEILING = 25.0, 400.0
MIN_AREA, MAX_AREA = 15.0, 300.0
MIN_PPS_THB, MAX_PPS_THB = 10_000.0, 600_000.0

# Same spelling folds as src/db._PROVINCE_ALIASES / web/lib/cities.ts, so a
# city split across two province spellings shares one baseline.
PROVINCE_ALIASES = {
    "chiang-mai": "chiangmai", "chiang-rai": "chiangrai", "hua-hin": "huahin",
    "chon-buri": "chonburi", "ko-samui": "samui", "koh-samui": "samui",
}


def thb_pps(row: dict, thb_per_usd: float) -> float | None:
    """Sale price per m2 in THB, or None when the row is not plausible."""
    pps, cur, area = row.get("price_per_sqm"), row.get("currency"), row.get("area_sqm")
    if pps is None:
        return None
    if area is not None and not (MIN_AREA <= float(area) <= MAX_AREA):
        return None
    v = float(pps)
    if cur == "USD":
        v *= thb_per_usd
    elif cur != "THB":
        return None
    return v if MIN_PPS_THB <= v <= MAX_PPS_THB else None


def _prov(p: str | None) -> str | None:
    return PROVINCE_ALIASES.get(p, p) if p else None


def score_buildings(
    building_pps: dict[str, float],
    region_of: dict[str, str | None],
    province_of: dict[str, str | None],
    min_buildings: int = MIN_BUILDINGS,
) -> tuple[dict[str, float | None], dict[str, float]]:
    """{condo_id: bubble or None (implausible)}, {region_id: median value}.

    Values are divided by the median value of the building's district, or
    outside Bangkok its province, when that group has min_buildings. Used for
    THB/m2 (step 3) and for re-basing stored scores (step 3b)."""
    by_region: dict[str, list[float]] = defaultdict(list)
    by_prov: dict[str, list[float]] = defaultdict(list)
    for cid, v in building_pps.items():
        if region_of.get(cid):
            by_region[region_of[cid]].append(v)
        p = _prov(province_of.get(cid))
        if p and p != "bangkok":
            by_prov[p].append(v)
    region_med = {r: statistics.median(v) for r, v in by_region.items() if len(v) >= min_buildings}
    prov_med = {p: statistics.median(v) for p, v in by_prov.items() if len(v) >= min_buildings}

    out: dict[str, float | None] = {}
    for cid, v in building_pps.items():
        base = region_med.get(region_of.get(cid) or "")
        if base is None:
            base = prov_med.get(_prov(province_of.get(cid)) or "")
        if not base:
            continue
        bi = round(v / base * 100, 2)
        out[cid] = bi if BI_FLOOR <= bi <= BI_CEILING else None
    return out, region_med


def _fetch_keyset(client, table: str, columns: str, key: str = "id", **eq) -> list[dict]:
    out: list[dict] = []
    last = None
    while True:
        q = client.table(table).select(columns)
        for k, v in eq.items():
            q = q.eq(k, v)
        if last is not None:
            q = q.gt(key, last)
        page = q.order(key).limit(PAGE).execute().data or []
        out.extend(page)
        if len(page) < PAGE:
            return out
        last = page[-1][key]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--thb-per-usd", type=float, default=34.0)
    ap.add_argument("--backup", help="CSV of value_scores (condo_id, bubble_index, computed_at) before writing")
    args = ap.parse_args()

    from src.db import get_client
    client = get_client()

    listings = _fetch_keyset(
        client, "listings", "id, condo_id, price_per_sqm, currency, area_sqm",
        listing_type="sale", is_active=True,
    )
    per_condo: dict[str, list[float]] = defaultdict(list)
    dropped = 0
    for l in listings:
        v = thb_pps(l, args.thb_per_usd)
        if v is None:
            dropped += 1
            continue
        per_condo[l["condo_id"]].append(v)
    logger.info(f"sale listings: {len(listings)}, used {len(listings) - dropped}, dropped {dropped}")

    condos = _fetch_keyset(client, "condos", "id, region_id, province", is_active=True)
    region_of = {c["id"]: c.get("region_id") for c in condos}
    province_of = {c["id"]: c.get("province") for c in condos}
    building_pps = {cid: statistics.median(v) for cid, v in per_condo.items() if cid in region_of}

    scores, region_med = score_buildings(building_pps, region_of, province_of)
    published = {k: v for k, v in scores.items() if v is not None}
    logger.info(f"buildings priced: {len(building_pps)}, scored: {len(published)}, "
                f"implausible (nulled): {len(scores) - len(published)}, districts with baseline: {len(region_med)}")

    # 3b. Re-base stored scores of buildings that cannot be priced today.
    existing = _fetch_keyset(client, "value_scores", "condo_id, bubble_index, computed_at", key="condo_id")
    stored = {r["condo_id"]: float(r["bubble_index"]) for r in existing
              if r.get("bubble_index") is not None and r["condo_id"] not in building_pps
              and r["condo_id"] in region_of and float(r["bubble_index"]) > 0}
    rebased, _ = score_buildings(stored, region_of, province_of)
    carried = {k: v for k, v in rebased.items() if v is not None}
    logger.info(f"stored scores without a price today: {len(stored)}, re-based: {len(carried)}")
    published.update(carried)

    by_prov: dict[str, list[float]] = defaultdict(list)
    for cid, bi in published.items():
        p = province_of.get(cid) or "?"
        by_prov[_prov(p) or "?"].append(bi)
    for p, v in sorted(by_prov.items(), key=lambda kv: -len(kv[1]))[:12]:
        logger.info(f"  {p:22s} n={len(v):5d} median bubble={statistics.median(v):6.1f}")

    if args.backup and not args.dry_run:
        with open(args.backup, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=["condo_id", "bubble_index", "computed_at"])
            w.writeheader()
            w.writerows(existing)
        logger.info(f"backup: {args.backup} ({len(existing)} rows)")
    to_null = [r["condo_id"] for r in existing
               if r.get("bubble_index") is not None and r["condo_id"] not in published]
    logger.info(f"value_scores rows: upsert {len(published)}, set bubble_index null on {len(to_null)}")

    if args.dry_run:
        logger.info("dry-run -- not writing")
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = [{"condo_id": cid, "bubble_index": bi, "computed_at": now} for cid, bi in published.items()]
    for i in range(0, len(rows), 500):
        client.table("value_scores").upsert(rows[i:i + 500], on_conflict="condo_id", returning="minimal").execute()
    for i in range(0, len(to_null), 150):
        client.table("value_scores").update({"bubble_index": None, "computed_at": now}, returning="minimal") \
            .in_("condo_id", to_null[i:i + 150]).execute()
    for rid, med in region_med.items():
        client.table("regions").update(
            {"avg_price_per_sqm": round(med, 2), "last_recalculated_at": now}, returning="minimal"
        ).eq("id", rid).execute()
    logger.info(f"upserted {len(rows)} value_scores rows; nulled {len(to_null)}; {len(region_med)} regions updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
