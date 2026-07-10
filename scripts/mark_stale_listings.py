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


def _count_active(client, source: str) -> int:
    return (
        client.table("listings")
        .select("id", count="exact", head=True)
        .eq("source", source)
        .eq("is_active", True)
        .execute()
        .count
    ) or 0


def _count_stale(client, source: str, cutoff: str) -> int:
    return (
        client.table("listings")
        .select("id", count="exact", head=True)
        .eq("source", source)
        .eq("is_active", True)
        .lt("last_seen_at", cutoff)
        .execute()
        .count
    ) or 0


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
        before_active = _count_active(client, source)
        stale = _count_stale(client, source, cutoff)
        logger.info(f"  {source:12s}  active={before_active:>7,}  stale(>{args.days}d)={stale:>7,}")
        total_stale += stale

        if dry_run or stale == 0:
            continue

        # Single filtered UPDATE per source — PostgREST applies it server-side
        # to every matching row in one request, no pagination needed.
        (
            client.table("listings")
            .update({"is_active": False})
            .eq("source", source)
            .eq("is_active", True)
            .lt("last_seen_at", cutoff)
            .execute()
        )
        after_active = _count_active(client, source)
        logger.info(f"    -> deactivated {stale}; active now {after_active:,}")

    if dry_run:
        logger.info(f"\nDRY-RUN — {total_stale} listings would be marked inactive. Pass --apply to commit.")
    else:
        logger.info(f"\nDone. {total_stale} listings marked inactive across {len(SOURCES)} sources.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
