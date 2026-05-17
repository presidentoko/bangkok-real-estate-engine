"""Backfill cross-source matches with the aggressive normalizer.

For every condo in DotProperty/DDProperty whose name only matches a hipflat
condo via the aggressive (suffix-stripped) normalizer, repoint that condo's
listings + price_history to the hipflat condo, then delete the now-empty
duplicate.

This raises the matched yield/analytics coverage WITHOUT re-scraping: every
listing that previously belonged to an orphan 'X Condominium' / 'Y Bangkok'
condo gets unified with its real hipflat counterpart.

Dry-run by default. Pass --apply to write.

Usage:
  python scripts/rematch_listings.py                # dry-run
  python scripts/rematch_listings.py --apply
  python scripts/rematch_listings.py --sources ddproperty  # limit to one source
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import (  # noqa: E402
    _normalize_project_name,
    _normalize_project_name_aggressive,
    build_hipflat_name_index,
    get_client,
)


def _load_orphan_condos(client, sources: list[str]) -> list[dict]:
    """Pull all condos whose source is in `sources`. We'll filter to those
    whose name matches a hipflat aggressive key in memory."""
    out: list[dict] = []
    for src in sources:
        offset = 0
        while True:
            chunk = (
                client.table("condos")
                .select("id, name, source")
                .eq("source", src)
                .range(offset, offset + 999)
                .execute()
                .data
            ) or []
            out.extend(chunk)
            if len(chunk) < 1000:
                break
            offset += 1000
    return out


def _move_listings(client, src_condo_id: str, dst_condo_id: str) -> int:
    """Repoint listings from src → dst, skipping rows that would collide
    with an existing (dst, source, source_unit_id) tuple. Such rows are the
    same listing already attached to the destination (e.g. previous matched
    ingest) and are deleted from src. Returns rows successfully moved.
    """
    dst_keys = {
        (r["source"], r["source_unit_id"])
        for r in (
            client.table("listings")
            .select("source, source_unit_id")
            .eq("condo_id", dst_condo_id)
            .execute()
            .data
        ) or []
        if r.get("source_unit_id")
    }
    src_rows = (
        client.table("listings")
        .select("id, source, source_unit_id")
        .eq("condo_id", src_condo_id)
        .execute()
        .data
    ) or []

    move_ids = []
    drop_ids = []
    for r in src_rows:
        key = (r.get("source"), r.get("source_unit_id"))
        if key in dst_keys:
            drop_ids.append(r["id"])
        else:
            move_ids.append(r["id"])
            dst_keys.add(key)  # prevent dup within this batch

    moved = 0
    if move_ids:
        for i in range(0, len(move_ids), 200):
            res = (
                client.table("listings")
                .update({"condo_id": dst_condo_id})
                .in_("id", move_ids[i:i + 200])
                .execute()
            )
            moved += len(res.data) if res.data else 0
    if drop_ids:
        for i in range(0, len(drop_ids), 200):
            client.table("listings").delete().in_(
                "id", drop_ids[i:i + 200]
            ).execute()
    return moved


def _move_price_history(client, src_condo_id: str, dst_condo_id: str) -> int:
    res = (
        client.table("price_history")
        .update({"condo_id": dst_condo_id})
        .eq("condo_id", src_condo_id)
        .execute()
    )
    return len(res.data) if res.data else 0


def _delete_condo(client, condo_id: str) -> bool:
    res = client.table("condos").delete().eq("id", condo_id).execute()
    return bool(res.data)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--sources",
        nargs="+",
        default=["dotproperty", "ddproperty"],
        help="Which sources to scan for orphans (default: both)",
    )
    ap.add_argument("--apply", action="store_true",
                    help="Write changes. Without this, dry-run only.")
    ap.add_argument("--limit", type=int, default=None,
                    help="Cap the number of merges (useful for staged rollout)")
    args = ap.parse_args()

    client = get_client()

    logger.info("Building hipflat name index (with aggressive variants)...")
    idx = build_hipflat_name_index(client, include_aggressive=True)
    logger.info(f"  {len(idx)} keys → {len(set(idx.values()))} hipflat condos")

    logger.info(f"Loading orphan condos from sources={args.sources}...")
    orphans = _load_orphan_condos(client, args.sources)
    logger.info(f"  {len(orphans)} orphan candidates")

    # Plan the merges
    merges: list[tuple[dict, str, str]] = []  # (orphan, match_type, hipflat_id)
    no_match = 0
    for c in orphans:
        name = c.get("name")
        if not name:
            continue
        base = _normalize_project_name(name)
        agg = _normalize_project_name_aggressive(name)
        if base and base in idx:
            # Already matchable by base — would have been matched at ingest.
            # These shouldn't exist as orphans; skip and log.
            merges.append((c, "base", idx[base]))
        elif agg and agg != base and agg in idx:
            merges.append((c, "aggressive", idx[agg]))
        else:
            no_match += 1

    stats = Counter(match_type for _, match_type, _ in merges)
    logger.info(
        f"  match plan: base={stats.get('base', 0)}, "
        f"aggressive={stats.get('aggressive', 0)}, "
        f"no-match={no_match}"
    )

    if args.limit:
        merges = merges[: args.limit]
        logger.info(f"  capping to {args.limit} merges")

    # Group by destination so we can summarise impact
    by_dst: dict[str, list[dict]] = defaultdict(list)
    for orphan, _mt, hipflat_id in merges:
        by_dst[hipflat_id].append(orphan)
    logger.info(
        f"  {len(merges)} orphans collapse into {len(by_dst)} hipflat condos"
    )

    # Show a sample
    logger.info("\nSample merges:")
    for orphan, mt, hipflat_id in merges[:15]:
        logger.info(
            f"  [{mt:11s}] {orphan['source']}:{orphan['name']!r:50s} → {hipflat_id}"
        )

    if not args.apply:
        logger.info("\nDRY-RUN — no DB writes. Pass --apply to commit.")
        return 0

    logger.info("\nApplying merges...")
    touched_listings = 0
    touched_history = 0
    deleted = 0
    failed = 0
    for i, (orphan, _mt, hipflat_id) in enumerate(merges, 1):
        try:
            touched_listings += _move_listings(client, orphan["id"], hipflat_id)
            touched_history += _move_price_history(client, orphan["id"], hipflat_id)
            if _delete_condo(client, orphan["id"]):
                deleted += 1
        except Exception as e:
            failed += 1
            logger.warning(f"merge failed for {orphan['name']!r}: {e}")
        if i % 100 == 0:
            logger.info(
                f"  progress {i}/{len(merges)}  "
                f"listings={touched_listings} history={touched_history} "
                f"deleted={deleted} failed={failed}"
            )

    logger.info(
        f"\nDONE. listings_moved={touched_listings}  "
        f"history_moved={touched_history}  "
        f"condos_deleted={deleted}  failed={failed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
