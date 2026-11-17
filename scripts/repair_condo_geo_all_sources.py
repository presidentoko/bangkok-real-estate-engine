"""Province, khet and flood level for every source, not just hipflat.

scripts/repair_condo_region_polygon.py (2026-11-10) moved hipflat Bangkok
condos to the khet their coordinates are in. The other ~6,000 Bangkok pages
(fazwaz, ddproperty, dotproperty) were never re-assigned, so 218 of them
showed a flood level that is not their district's (17 Bang Khen buildings at
L2 in an L5 district) and 1,137 inside a polygon had none at all (data audit
2026-11-17, H7/H8/M8/M9/M10). This applies one rule to the whole table:

  province   61 ddproperty rows filed as Bangkok sit in Phuket (lat < 9,
             lng < 99) -> phuket. 8 hipflat "ko-samui" rows sit on the Surat
             Thani mainland (lng < 99.6) -> surat-thani. Three rows whose
             coordinates and original slug both say Bangkok -> bangkok
             (MANUAL_PROVINCE).
  coords     Placeholder geocodes -- one point shared by 5+ differently named
             buildings, not one project's phases -- and three points that
             contradict the building's own name (MANUAL_NULL_COORDS) are
             nulled, so they stop placing a building in the wrong khet.
  region_id  Bangkok: the khet polygon the point is in
             (src/data/flood_polygons.assign_district, same rule as /flood),
             else the stored khet. The duplicate wang-thong-lang region is
             folded into wang-thonglang (the polygon's name), and the four
             Bangkok-province regions named after other cities ("bangkok",
             "chiang-mai", "chon-buri", "phuket") are dropped from condos.
             Outside Bangkok: a link to a Bangkok khet is cleared.
  risk       Bangkok: flood_risk_level / subsidence_level of the assigned
             khet (district_static), risk_penalty shifted 4 points per flood
             level as compute_risk does. Outside Bangkok the flood and
             subsidence levels are cleared: both layers are Bangkok-only.

Slugs are left alone here; scripts/repair_condo_slug_city.py renames the
ones whose city word no longer matches the province.

Dry run by default. Every changed row is written to a CSV in data/backups/
before anything is sent.

    python scripts/repair_condo_geo_all_sources.py            # dry run
    python scripts/repair_condo_geo_all_sources.py --apply
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
if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.data.flood_districts import FLOOD_RISK_BY_DISTRICT  # noqa: E402
from src.data.flood_polygons import _layer, assign_district, district_slug  # noqa: E402
from src.data.subsidence_districts import SUBSIDENCE_LEVEL_BY_DISTRICT  # noqa: E402

FLOOD_BY_SLUG = {district_slug(k): v for k, v in FLOOD_RISK_BY_DISTRICT.items()}
SUB_BY_SLUG = {district_slug(k): v for k, v in SUBSIDENCE_LEVEL_BY_DISTRICT.items()}

MANUAL_PROVINCE = {
    # coordinates (Bang Khae / Ekkamai / On Nut) and the slug minted first
    # all say Bangkok; only the province column said otherwise.
    "royal-green-park-bangkok": "bangkok",
    "park-avenue-bangkok": "bangkok",
    "chambers-on-nut-station-hua-hin": "bangkok",
}
MANUAL_NULL_COORDS = {
    "kata-boutique-residence-phuket",              # Kata, geocoded to Khlong Toei
    "new-nordic-trend-chon-buri-pattaya-pattaya",  # Pattaya, geocoded to Khan Na Yao
    "sarisa-ville-2-chiang-mai",                   # Chiang Mai, geocoded to lat 8.80
}
# Bangkok-province regions named after other cities.
BOGUS_BKK_REGIONS = {"bangkok", "chiang-mai", "chon-buri", "phuket"}
REGION_ALIASES = {"wang-thong-lang": "wang-thonglang"}
MIN_PLACEHOLDER_NAMES = 5


def placeholder_points(condos: list[dict]) -> set[tuple[float, float]]:
    """Points shared by MIN_PLACEHOLDER_NAMES+ differently named buildings,
    unless most of those names share a first word (one project's phases:
    "Mahasap Condo Town Project 3/6", "New Nordic Castle 1/2")."""
    by_pt: dict[tuple, set[str]] = defaultdict(set)
    for c in condos:
        if c.get("latitude") is None or c.get("longitude") is None:
            continue
        by_pt[(round(c["latitude"], 5), round(c["longitude"], 5))].add((c.get("name") or "").strip().lower())
    out = set()
    for pt, names in by_pt.items():
        if len(names) < MIN_PLACEHOLDER_NAMES:
            continue
        first = Counter(n.split(" ")[0] for n in names if n)
        if first and first.most_common(1)[0][1] / len(names) >= 0.6:
            continue
        out.add(pt)
    return out


def corrected_province(c: dict, placeholders: set[tuple[float, float]] = frozenset()) -> str | None:
    """The province this row belongs in, or None to keep it. A placeholder
    point says nothing about where the building is, so it moves nothing."""
    slug, prov = c.get("slug") or "", c.get("province")
    if slug in MANUAL_PROVINCE:
        new = MANUAL_PROVINCE[slug]
        return new if new != prov else None
    lat, lng = c.get("latitude"), c.get("longitude")
    if lat is None or lng is None or (round(lat, 5), round(lng, 5)) in placeholders:
        return None
    if prov == "bangkok" and lat < 9.0 and lng < 99.0:
        return "phuket"
    if prov == "ko-samui" and lng < 99.6:
        return "surat-thani"
    return None


def fetch_all(client, table: str, cols: str, order: str = "id") -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        page = client.table(table).select(cols).order(order).range(offset, offset + 999).execute().data or []
        out.extend(page)
        if len(page) < 1000:
            return out
        offset += 1000


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    logger.info(f"backup: {path} ({len(rows)} rows)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--backup-dir", default=str(ROOT / "data" / "backups"))
    args = ap.parse_args()

    from src.db import get_client
    client = get_client()
    condos = fetch_all(client, "condos",
                       "id, slug, name, source, province, region_id, latitude, longitude, is_active, published")
    regions = fetch_all(client, "regions", "id, name, province")
    risk = {r["condo_id"]: r for r in fetch_all(
        client, "risk_factors",
        "condo_id, flood_risk_level, flood_risk_source, subsidence_level, subsidence_source, risk_penalty",
        order="condo_id")}
    reg_by_id = {r["id"]: r for r in regions}
    bkk_region_id = {r["name"]: r["id"] for r in regions if r["province"] == "bangkok"}
    missing = [s for s in _layer() if s not in bkk_region_id]
    if missing:
        logger.error(f"no Bangkok regions row for polygons: {missing}")
        return 1
    logger.info(f"{len(condos)} condos, {len(regions)} regions, {len(risk)} risk rows")

    placeholders = placeholder_points(condos)
    changes: list[dict] = []
    risk_changes: list[dict] = []
    stats: Counter = Counter()

    for c in condos:
        old = {k: c.get(k) for k in ("province", "region_id", "latitude", "longitude")}
        new = dict(old)
        slug = c.get("slug") or ""

        p = corrected_province(c, placeholders)
        if p:
            new["province"] = p
            stats[f"province {old['province']} -> {p}"] += 1

        lat, lng = new["latitude"], new["longitude"]
        if lat is not None and lng is not None and (
            slug in MANUAL_NULL_COORDS or (round(lat, 5), round(lng, 5)) in placeholders
        ):
            new["latitude"] = new["longitude"] = None
            stats["coords nulled"] += 1

        reg = reg_by_id.get(new["region_id"] or "")
        stored = reg["name"] if reg else None
        stored_prov = reg["province"] if reg else None
        if new["province"] == "bangkok":
            if stored_prov is not None and stored_prov != "bangkok":
                stored = None
            stored = REGION_ALIASES.get(stored, stored)
            if stored in BOGUS_BKK_REGIONS:
                stored = None
            assigned = assign_district(new["latitude"], new["longitude"], stored)
            if assigned is not None and assigned not in bkk_region_id:
                assigned = None
            new["region_id"] = bkk_region_id[assigned] if assigned else None
        elif stored_prov == "bangkok":
            new["region_id"] = None

        if new != old:
            if new["region_id"] != old["region_id"]:
                stats["region changed"] += 1
            changes.append({
                "id": c["id"], "slug": slug, "source": c.get("source"),
                **{f"old_{k}": v for k, v in old.items()},
                **{f"new_{k}": v for k, v in new.items()},
                "old_region": (reg_by_id.get(old["region_id"] or "") or {}).get("name"),
                "new_region": (reg_by_id.get(new["region_id"] or "") or {}).get("name"),
            })

        # risk_factors
        r = risk.get(c["id"])
        old_flood = r.get("flood_risk_level") if r else None
        old_sub = r.get("subsidence_level") if r else None
        if new["province"] == "bangkok":
            name = (reg_by_id.get(new["region_id"] or "") or {}).get("name")
            if name is None:
                continue  # no khet known: leave whatever is stored
            nf, ns = FLOOD_BY_SLUG.get(name), SUB_BY_SLUG.get(name)
            src = "district_static"
        else:
            if old_flood is None and old_sub is None:
                continue
            nf = ns = None
            src = None
        if r and old_flood == nf and old_sub == ns:
            continue
        old_pen = float((r or {}).get("risk_penalty") or 0)
        risk_changes.append({
            "condo_id": c["id"], "slug": slug, "row_existed": bool(r),
            "old_flood_risk_level": old_flood, "new_flood_risk_level": nf,
            "old_flood_risk_source": (r or {}).get("flood_risk_source"),
            "new_flood_risk_source": src if nf is not None else None,
            "old_subsidence_level": old_sub, "new_subsidence_level": ns,
            "old_subsidence_source": (r or {}).get("subsidence_source"),
            "new_subsidence_source": src if ns is not None else None,
            "old_risk_penalty": (r or {}).get("risk_penalty"),
            "new_risk_penalty": max(0.0, old_pen + ((nf or 0) - (old_flood or 0)) * 4),
        })

    for k, v in sorted(stats.items()):
        logger.info(f"  {k}: {v}")
    moves = Counter((x["old_region"], x["new_region"]) for x in changes if x["old_region_id"] != x["new_region_id"])
    for (a, b), n in moves.most_common(20):
        logger.info(f"  region {a} -> {b}: {n}")
    fl = Counter((x["old_flood_risk_level"], x["new_flood_risk_level"]) for x in risk_changes)
    logger.info(f"risk changes: {len(risk_changes)}; flood (old,new) top: {fl.most_common(12)}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bdir = Path(args.backup_dir)
    bdir.mkdir(parents=True, exist_ok=True)
    tag = "" if args.apply else "_dryrun"
    write_csv(bdir / f"condos_geo_all_sources_{stamp}{tag}.csv", changes)
    write_csv(bdir / f"risk_factors_geo_all_sources_{stamp}{tag}.csv", risk_changes)

    if not args.apply:
        logger.info("dry run -- nothing written")
        return 0

    # condos: group identical payloads so most go out as one UPDATE per chunk.
    groups: dict[tuple, list[str]] = defaultdict(list)
    for x in changes:
        payload = {}
        for k in ("province", "region_id", "latitude", "longitude"):
            if x[f"old_{k}"] != x[f"new_{k}"]:
                payload[k] = x[f"new_{k}"]
        groups[tuple(sorted(payload.items()))].append(x["id"])
    n = 0
    for payload, ids in groups.items():
        for i in range(0, len(ids), 150):
            client.table("condos").update(dict(payload), returning="minimal").in_("id", ids[i:i + 150]).execute()
            n += len(ids[i:i + 150])
    logger.info(f"updated {n} condos")

    now = datetime.now(timezone.utc).isoformat()
    rows = [{
        "condo_id": x["condo_id"],
        "flood_risk_level": x["new_flood_risk_level"],
        "flood_risk_source": x["new_flood_risk_source"],
        "subsidence_level": x["new_subsidence_level"],
        "subsidence_source": x["new_subsidence_source"],
        "risk_penalty": x["new_risk_penalty"],
        "computed_at": now,
    } for x in risk_changes]
    for i in range(0, len(rows), 500):
        client.table("risk_factors").upsert(rows[i:i + 500], on_conflict="condo_id", returning="minimal").execute()
    logger.info(f"upserted {len(rows)} risk_factors rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
