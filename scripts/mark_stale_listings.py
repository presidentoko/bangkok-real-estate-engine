"""Mark stale listings inactive.

dotproperty/ddproperty/fazwaz listings are only ever flipped to is_active=True
(on every sighting during ingest) — nothing ever flips them back to False when
a listing disappears from the source (sold / delisted / expired). Dead
listings then pollute every median (yields, price snapshots, value scores)
forever. This script closes that gap: for each of those three sources, any
listing still marked active that hasn't been re-seen in --days days gets
is_active=false.

A listing that gets re-scraped later naturally reactivates: the ingest
upserts always set is_active=True and refresh last_seen_at on every sighting
(verified in src/db.py's upsert_dotproperty_listing / upsert_fazwaz_listing /
upsert_ddproperty_listing), so this sweep is safe to run repeatedly.

hipflat is deliberately excluded — persist_detail_b() already manages its
own is_active lifecycle per condo (marks all rows inactive, then upserts the
current scrape back to active), so a blanket time-based sweep isn't needed
and could fight with it.

Dry-run by default. Pass --apply to write.

Usage:
  python scripts/mark_stale_listings.py                  # dry-run, default 21 days
  python scripts/mark_stale_listings.py --apply
  python scripts/mark_stale_listings.py --days 14 --apply
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402


SOURCES = ("dotproperty", "ddproperty", "fazwaz")
DEFAULT_STALE_DAYS = 21


# Update chunk size. listings.id is uuid (db/schema.sql), so 200 ids in an
# `in_()` filter is ~7.4KB of URL — comfortably under URL-length limits.
UPDATE_CHUNK = 200


def _fetch_stale_ids(client, source: str, cutoff: str) -> list[str]:
    """Return the ids of all stale-active listings for a source.

    NOTE: we deliberately do NOT use `select(..., count="exact", head=True)`;
    on this supabase-py/postgrest version it returns count=0 even when rows
    exist, which previously made this whole script a no-op. Paginating the
    ids gives an accurate count AND the exact rows to update. `.order("id")`
    is required for stable pagination across separate .range() requests.
    """
    ids: list[str] = []
    offset = 0
    while True:
        chunk = (
            client.table("listings")
            .select("id")
            .eq("source", source)
            .eq("is_active", True)
            .lt("last_seen_at", cutoff)
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
        ) or []
        ids.extend(r["id"] for r in chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return ids


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=DEFAULT_STALE_DAYS,
                     help=f"Mark listings inactive if not seen in this many days (default {DEFAULT_STALE_DAYS})")
    ap.add_argument("--apply", action="store_true",
                     help="Write changes. Without this, dry-run only.")
    args = ap.parse_args()
    dry_run = not args.apply

    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()
    logger.info(f"Stale cutoff: last_seen_at < {cutoff} ({args.days} days)")

    client = get_client()

    total_stale = 0
    for source in SOURCES:
        stale_ids = _fetch_stale_ids(client, source, cutoff)
        stale = len(stale_ids)
        logger.info(f"  {source:12s}  stale(>{args.days}d)={stale:>7,}")
        total_stale += stale

        if dry_run or stale == 0:
            continue

        # Update in chunks of UPDATE_CHUNK ids. A single filtered UPDATE would
        # default to returning=representation and serialize every updated row
        # (tens of MB of egress at ~50k rows) in one response, risking a
        # statement timeout. returning="minimal" skips the response body
        # entirely (postgrest 0.18.0 supports the kwarg on .update()).
        deactivated = 0
        n_chunks = (stale + UPDATE_CHUNK - 1) // UPDATE_CHUNK
        for i in range(0, stale, UPDATE_CHUNK):
            chunk = stale_ids[i : i + UPDATE_CHUNK]
            (
                client.table("listings")
                .update({"is_active": False}, returning="minimal")
                .in_("id", chunk)
                .execute()
            )
            deactivated += len(chunk)
            chunk_no = i // UPDATE_CHUNK + 1
            if chunk_no % 10 == 0 or chunk_no == n_chunks:
                logger.info(
                    f"    {source}: deactivated {deactivated:,}/{stale:,} "
                    f"(chunk {chunk_no}/{n_chunks})"
                )
        logger.info(f"    -> {source}: {deactivated:,} listings marked inactive")

    if dry_run:
        logger.info(f"\nDRY-RUN — {total_stale} listings would be marked inactive. Pass --apply to commit.")
    else:
        logger.info(f"\nDone. {total_stale} listings marked inactive across {len(SOURCES)} sources.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
