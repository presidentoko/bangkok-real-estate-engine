"""Per-developer aggregates — the "developer report card".

Developer identity comes from FazWaz project pages (condos.developer_slug, see
src/scrapers/fazwaz_project.parse_developer). Those FazWaz-tagged buildings
carry gross yield and foreign-quota signals (but NOT our hipflat-only liquidity
or Bangkok-only flood/subsidence), so we roll up what's actually there:

  * tracked_buildings    — how many condos WE track for this developer
  * avg_gross_yield_pct  — their buildings' average rental yield
  * avg_foreign_quota_pct— average share of foreign-eligible inventory
  * fazwaz_project/unit   — their total portfolio size on FazWaz (experience proxy)

The pure aggregate_developers() is unit-tested; compute_developer_stats() does
the DB I/O and upserts into the `developers` table.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from loguru import logger
from supabase import Client


def _mean(xs: list) -> float | None:
    vals = [float(x) for x in xs if x is not None]
    return round(sum(vals) / len(vals), 2) if vals else None


def aggregate_developers(rows: list[dict]) -> list[dict]:
    """Group condo rows (each with developer_slug) into per-developer stats."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        slug = r.get("developer_slug")
        if slug:
            groups[slug].append(r)

    out: list[dict] = []
    for slug, members in groups.items():
        names = [m.get("developer") for m in members if m.get("developer")]
        pcs = [m["developer_project_count"] for m in members
               if m.get("developer_project_count") is not None]
        ucs = [m["developer_unit_count"] for m in members
               if m.get("developer_unit_count") is not None]
        out.append({
            "developer_slug": slug,
            "developer_name": names[0] if names else None,
            "fazwaz_project_count": max(pcs) if pcs else None,
            "fazwaz_unit_count": max(ucs) if ucs else None,
            "tracked_buildings": len(members),
            "avg_gross_yield_pct": _mean([m.get("gross_yield_pct") for m in members]),
            "avg_foreign_quota_pct": _mean(
                [m.get("foreign_quota_inventory_pct") for m in members]
            ),
        })
    return out


def compute_developer_stats(client: Client) -> int:
    """Recompute the developers table from all developer-tagged condos."""
    rows: list[dict] = []
    offset = 0
    while True:
        chunk = (
            client.table("condos")
            .select("developer_slug, developer, developer_project_count, "
                    "developer_unit_count, gross_yield_pct, "
                    "foreign_quota_inventory_pct")
            .not_.is_("developer_slug", "null")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
        ) or []
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000

    stats = aggregate_developers(rows)
    now = datetime.now(timezone.utc).isoformat()
    for s in stats:
        s["computed_at"] = now

    for i in range(0, len(stats), 500):
        client.table("developers").upsert(
            stats[i:i + 500], on_conflict="developer_slug"
        ).execute()
    logger.info(
        f"developer stats for {len(stats)} developers "
        f"from {len(rows)} tagged condos"
    )
    return len(stats)
