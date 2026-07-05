"""Populate risk_factors.flood_risk_level + subsidence_level from condos.region.

Joins each hipflat condo's region (slug or canonical name) to the static
FLOOD_RISK_BY_DISTRICT and SUBSIDENCE_LEVEL_BY_DISTRICT mappings in src/data/.

The regions table holds both slug ("bang-khun-thian") and canonical
("Bang Khun Thian") variants of the same khet — we normalise both sides
before matching, identical to the JS normaliser in InventoryMap.tsx.

Flood/subsidence level is a static lookup by district — it never changes for
a condo whose region hasn't changed, so by default we skip condos that
already have both levels set. Pass --force to recompute everyone (e.g. after
a district mapping change or a batch of backfill_province reassignments).

Usage:
  python scripts/populate_risk_factors.py
  python scripts/populate_risk_factors.py --force
  python scripts/populate_risk_factors.py --dry-run
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger  # noqa: E402

from src.data.flood_districts import FLOOD_RISK_BY_DISTRICT  # noqa: E402
from src.data.subsidence_districts import SUBSIDENCE_LEVEL_BY_DISTRICT  # noqa: E402
from src.db import get_client  # noqa: E402

_NORM_RE = re.compile(r"[\s\-_]+")


def _norm(s: str | None) -> str:
    return _NORM_RE.sub("", (s or "").lower())


def _build_lookup() -> dict[str, int]:
    """{normalised name: flood level}."""
    return {_norm(name): lvl for name, lvl in FLOOD_RISK_BY_DISTRICT.items()}


def _build_subsidence_lookup() -> dict[str, int]:
    """{normalised name: subsidence level}."""
    return {_norm(name): lvl for name, lvl in SUBSIDENCE_LEVEL_BY_DISTRICT.items()}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true",
                     help="Recompute condos that already have both risk levels set.")
    args = ap.parse_args()

    client = get_client()
    lookup = _build_lookup()
    sub_lookup = _build_subsidence_lookup()

    # Pull all hipflat condos with a region. Supabase REST caps at 1000 per
    # request — paginate explicitly so we don't silently truncate.
    PAGE = 1000
    condos: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table("condos")
            .select("id, name, region_id, regions(name)")
            .eq("source", "hipflat")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        ) or []
        condos.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    logger.info(f"loaded {len(condos)} hipflat condos")

    if not args.force:
        already_done: set[str] = set()
        offset = 0
        while True:
            page = (
                client.table("risk_factors")
                .select("condo_id, flood_risk_level, subsidence_level")
                .range(offset, offset + PAGE - 1)
                .execute()
                .data
            ) or []
            for r in page:
                if r.get("flood_risk_level") is not None or r.get("subsidence_level") is not None:
                    already_done.add(r["condo_id"])
            if len(page) < PAGE:
                break
            offset += PAGE
        before = len(condos)
        condos = [c for c in condos if c["id"] not in already_done]
        logger.info(f"  skipping {before - len(condos)} already-scored condos "
                    f"({len(condos)} left; use --force to recompute all)")

    rows: list[dict] = []
    n_matched = n_skipped = 0
    unmatched_regions: dict[str, int] = {}
    now = datetime.now(timezone.utc).isoformat()

    for c in condos:
        rg = c.get("regions")
        rname = (rg.get("name") if isinstance(rg, dict) else (rg[0]["name"] if rg else None))
        key = _norm(rname)
        level = lookup.get(key)
        sub_level = sub_lookup.get(key)
        if level is None and sub_level is None:
            n_skipped += 1
            if rname:
                unmatched_regions[rname] = unmatched_regions.get(rname, 0) + 1
            continue
        rows.append({
            "condo_id": c["id"],
            "flood_risk_level": level,
            "flood_risk_source": "src/data/flood_districts.py" if level is not None else None,
            "subsidence_level": sub_level,
            "subsidence_source": "src/data/subsidence_districts.py" if sub_level is not None else None,
            "computed_at": now,
        })
        n_matched += 1

    logger.info(f"matched {n_matched}, skipped {n_skipped}")
    if unmatched_regions:
        logger.warning(f"unmatched regions ({len(unmatched_regions)} unique):")
        for r, n in sorted(unmatched_regions.items(), key=lambda x: -x[1])[:10]:
            logger.warning(f"  {r}  ({n} condos)")

    if args.dry_run:
        logger.info("dry-run — not writing")
        return 0

    if not rows:
        logger.info("nothing to write")
        return 0

    # Upsert in chunks of 500 to stay under PostgREST limits.
    for i in range(0, len(rows), 500):
        client.table("risk_factors").upsert(
            rows[i:i+500], on_conflict="condo_id"
        ).execute()
    logger.info(f"upserted {len(rows)} risk_factors rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
