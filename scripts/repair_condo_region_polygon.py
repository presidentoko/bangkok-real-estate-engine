"""Move hipflat Bangkok condos to the khet their coordinates are in, and
bring their report-card flood/subsidence levels in line.

condos.region_id for hipflat Bangkok came from matching district names in
the listing's text, which files ~25% of buildings in the wrong khet (a name
containing "Lumpini" -> Pathum Wan, "Sathorn" -> Sathon, wherever the tower
is). /flood places buildings by polygon instead, so the district pages,
the report cards and /flood disagreed. This applies the same rule
(src/data/flood_polygons.assign_district) to the stored data:

  * condos.region_id  -> the polygon's khet, only where coordinates exist
                         and the point is not within BOUNDARY_BUFFER_M of
                         the currently stored khet (boundary cases are kept).
  * risk_factors      -> flood_risk_level / subsidence_level of the assigned
                         khet, for every hipflat Bangkok condo whose row
                         disagrees or is missing; risk_penalty shifted by the
                         flood change (4 points per level, as compute_risk).

Slugs and URLs are untouched: a slug is {name}-{province} and is never
re-derived from the region once minted.

Dry run by default. Every changed row is written to a backup CSV under
data/backups/ BEFORE anything is sent. Writes use returning=minimal.

    python scripts/repair_condo_region_polygon.py            # dry run
    python scripts/repair_condo_region_polygon.py --apply
"""
from __future__ import annotations

import argparse
import csv
import io
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.data.flood_districts import FLOOD_RISK_BY_DISTRICT  # noqa: E402
from src.data.flood_polygons import (  # noqa: E402
    BOUNDARY_BUFFER_M,
    assign_district,
    distance_to_district_m,
    district_slug,
    locate,
)
from src.data.subsidence_districts import SUBSIDENCE_LEVEL_BY_DISTRICT  # noqa: E402
from src.db import get_client  # noqa: E402

PAGE = 1000
FLOOD_BY_SLUG = {district_slug(k): v for k, v in FLOOD_RISK_BY_DISTRICT.items()}
SUB_BY_SLUG = {district_slug(k): v for k, v in SUBSIDENCE_LEVEL_BY_DISTRICT.items()}


def fetch_all(client, table: str, cols: str, **eq) -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        q = client.table(table).select(cols).order("id" if table != "risk_factors" else "condo_id")
        for k, v in eq.items():
            q = q.eq(k, v)
        page = q.range(offset, offset + PAGE - 1).execute().data or []
        out.extend(page)
        if len(page) < PAGE:
            return out
        offset += PAGE


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--backup-dir", default=str(ROOT / "data" / "backups"))
    args = ap.parse_args()

    client = get_client()
    condos = fetch_all(
        client, "condos",
        "id, slug, name, latitude, longitude, region_id, regions(name)",
        source="hipflat", province="bangkok",
    )
    regions = fetch_all(client, "regions", "id, name, province")
    region_id_by_name = {r["name"]: r["id"] for r in regions if r.get("province") == "bangkok"}
    risk: dict[str, dict] = {}
    ids = [c["id"] for c in condos]
    for i in range(0, len(ids), 150):
        rows = (
            client.table("risk_factors")
            .select("condo_id, flood_risk_level, flood_risk_source, subsidence_level, "
                    "subsidence_source, risk_penalty")
            .in_("condo_id", ids[i:i + 150])
            .execute().data
        ) or []
        for r in rows:
            risk[r["condo_id"]] = r
    logger.info(f"{len(condos)} hipflat Bangkok condos, {len(risk)} risk_factors rows")

    region_changes: list[dict] = []
    risk_changes: list[dict] = []
    kept_boundary = 0
    missing_region: Counter = Counter()

    for c in condos:
        rg = c.get("regions")
        stored = (rg.get("name") if isinstance(rg, dict) else (rg[0]["name"] if rg else None))
        stored_slug = district_slug(stored)
        lat, lng = c.get("latitude"), c.get("longitude")
        assigned = assign_district(lat, lng, stored)

        if lat is not None and lng is not None and assigned and assigned != stored_slug:
            rid = region_id_by_name.get(assigned)
            if rid is None:
                missing_region[assigned] += 1
            else:
                region_changes.append({
                    "id": c["id"], "slug": c.get("slug"), "name": c.get("name"),
                    "latitude": lat, "longitude": lng,
                    "old_region_id": c.get("region_id"), "old_region": stored,
                    "new_region_id": rid, "new_region": assigned,
                    "m_from_old_district": round(distance_to_district_m(stored_slug, lat, lng) or -1, 1)
                    if stored_slug in FLOOD_BY_SLUG else "",
                })
        elif lat is not None and lng is not None and locate(lat, lng) not in (None, stored_slug):
            kept_boundary += 1

        new_flood = FLOOD_BY_SLUG.get(assigned or "")
        new_sub = SUB_BY_SLUG.get(assigned or "")
        if new_flood is None and new_sub is None:
            continue
        old = risk.get(c["id"])
        old_flood = old.get("flood_risk_level") if old else None
        old_sub = old.get("subsidence_level") if old else None
        if old and old_flood == new_flood and old_sub == new_sub:
            continue
        old_pen = float((old or {}).get("risk_penalty") or 0)
        new_pen = old_pen + ((new_flood or 0) - (old_flood or 0)) * 4
        risk_changes.append({
            "condo_id": c["id"], "row_existed": bool(old),
            "old_flood_risk_level": old_flood, "new_flood_risk_level": new_flood,
            "old_flood_risk_source": (old or {}).get("flood_risk_source"),
            "new_flood_risk_source": "district_static" if new_flood is not None else None,
            "old_subsidence_level": old_sub, "new_subsidence_level": new_sub,
            "old_subsidence_source": (old or {}).get("subsidence_source"),
            "new_subsidence_source": "district_static" if new_sub is not None else None,
            "old_risk_penalty": (old or {}).get("risk_penalty"), "new_risk_penalty": new_pen,
        })

    logger.info(f"region_id changes: {len(region_changes)}; boundary cases kept: {kept_boundary} "
                f"(within {BOUNDARY_BUFFER_M:.0f} m of stored khet)")
    if missing_region:
        logger.error(f"no Bangkok regions row for: {dict(missing_region)} -- aborting")
        return 1
    moves = Counter((r["old_region"], r["new_region"]) for r in region_changes)
    for (a, b), n in moves.most_common(15):
        logger.info(f"  {a} -> {b}: {n}")
    logger.info(f"risk_factors changes: {len(risk_changes)} "
                f"(new rows {sum(1 for r in risk_changes if not r['row_existed'])}, "
                f"null->level {sum(1 for r in risk_changes if r['old_flood_risk_level'] is None)})")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bdir = Path(args.backup_dir)
    bdir.mkdir(parents=True, exist_ok=True)
    tag = "" if args.apply else "_dryrun"
    for fname, rows in (
        (f"condos_region_polygon_{stamp}{tag}.csv", region_changes),
        (f"risk_factors_polygon_{stamp}{tag}.csv", risk_changes),
    ):
        if not rows:
            continue
        with open(bdir / fname, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        logger.info(f"backup: {bdir / fname} ({len(rows)} rows)")

    if not args.apply:
        logger.info("dry run -- nothing written")
        return 0

    # condos.region_id: one UPDATE per (target region, 150-id chunk).
    by_target: dict[str, list[str]] = defaultdict(list)
    for r in region_changes:
        by_target[r["new_region_id"]].append(r["id"])
    n = 0
    for rid, cids in by_target.items():
        for i in range(0, len(cids), 150):
            client.table("condos").update({"region_id": rid}, returning="minimal") \
                .in_("id", cids[i:i + 150]).execute()
            n += len(cids[i:i + 150])
    logger.info(f"updated region_id on {n} condos")

    now = datetime.now(timezone.utc).isoformat()
    payload = [{
        "condo_id": r["condo_id"],
        "flood_risk_level": r["new_flood_risk_level"],
        "flood_risk_source": r["new_flood_risk_source"],
        "subsidence_level": r["new_subsidence_level"],
        "subsidence_source": r["new_subsidence_source"],
        "risk_penalty": r["new_risk_penalty"],
        "computed_at": now,
    } for r in risk_changes]
    for i in range(0, len(payload), 500):
        client.table("risk_factors").upsert(
            payload[i:i + 500], on_conflict="condo_id", returning="minimal"
        ).execute()
    logger.info(f"upserted {len(payload)} risk_factors rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
