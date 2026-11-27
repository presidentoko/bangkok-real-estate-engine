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

hipflat is excluded by default — persist_detail_b() manages its own
is_active lifecycle per condo when it re-scrapes one. A condo it never
revisits keeps its rows active, though: on 2026-11-17 that was ~15,000
hipflat listings last seen around 2026-08-03 (data audit M7). The site's
"active listings" counts leave out hipflat rows older than 30 days
(web/lib/queries/condos.ts HIPFLAT_ACTIVE_DAYS). --hipflat-days N sweeps them
here too, but it is opt-in: deactivating them removes most hipflat yields
(1,491 -> 1,115 buildings, Bangkok yield districts 28 -> 8 when tried on
2026-11-17), which is a coverage decision, not a cleanup.

Dry-run by default. Pass --apply to write.

Usage:
  python scripts/mark_stale_listings.py                  # dry-run, default 21 days
  python scripts/mark_stale_listings.py --apply
  python scripts/mark_stale_listings.py --days 14 --apply
  python scripts/mark_stale_listings.py --apply --backup data/backups/x.csv
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
    # Keyset pagination (id > last), not OFFSET: hipflat has ~65k active rows
    # and a deep OFFSET scan hit the statement timeout.
    ids: list[str] = []
    last = None
    while True:
        q = (
            client.table("listings")
            .select("id")
            .eq("source", source)
            .eq("is_active", True)
            .lt("last_seen_at", cutoff)
        )
        if last is not None:
            q = q.gt("id", last)
        chunk = q.order("id").limit(1000).execute().data or []
        ids.extend(r["id"] for r in chunk)
        if len(chunk) < 1000:
            break
        last = chunk[-1]["id"]
    return ids


def _count_fresh(client, source: str, cutoff: str) -> int:
    """Active listings of a source seen since the cutoff (keyset, ids only)."""
    n = 0
    last = None
    while True:
        q = (
            client.table("listings")
            .select("id")
            .eq("source", source)
            .eq("is_active", True)
            .gte("last_seen_at", cutoff)
        )
        if last is not None:
            q = q.gt("id", last)
        chunk = q.order("id").limit(1000).execute().data or []
        n += len(chunk)
        if len(chunk) < 1000:
            break
        last = chunk[-1]["id"]
    return n


# Safety brake. "Not seen in 21 days" only means "gone" if the sweep that
# would have seen it actually ran. On 2026-11-22 the DotProperty sweep hit
# its 150-minute step limit and DDProperty its 60-minute one, FazWaz parsed
# zero cards (layout change), and this script then deactivated 17,661
# listings that had simply not been visited. Buildings lost their only
# listings, fell below the indexability bar and went noindex. A real week of
# delistings is a small fraction of a source; a sweep that did not run looks
# like most of it.
DEFAULT_MAX_STALE_FRAC = 0.4


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-stale-frac", type=float, default=DEFAULT_MAX_STALE_FRAC,
                     help="skip a source when more than this share of its active listings "
                          f"would be deactivated (default {DEFAULT_MAX_STALE_FRAC}); 1 disables")
    ap.add_argument("--days", type=int, default=DEFAULT_STALE_DAYS,
                     help=f"Mark listings inactive if not seen in this many days (default {DEFAULT_STALE_DAYS})")
    ap.add_argument("--hipflat-days", type=int, default=None,
                     help="Also sweep hipflat with this window (default: hipflat is skipped)")
    ap.add_argument("--backup", help="write the ids about to be deactivated to this CSV first")
    ap.add_argument("--apply", action="store_true",
                     help="Write changes. Without this, dry-run only.")
    args = ap.parse_args()
    dry_run = not args.apply

    now = datetime.now(timezone.utc)
    cutoffs = {s: (now - timedelta(days=args.days)).isoformat() for s in SOURCES}
    if args.hipflat_days:
        cutoffs["hipflat"] = (now - timedelta(days=args.hipflat_days)).isoformat()
    logger.info(f"Stale cutoff: last_seen_at < {cutoffs[SOURCES[0]]} ({args.days} days)"
                + (f", hipflat < {cutoffs['hipflat']} ({args.hipflat_days} days)" if args.hipflat_days else ""))

    client = get_client()

    stale_by_source = {s: _fetch_stale_ids(client, s, c) for s, c in cutoffs.items()}
    for s in list(stale_by_source):
        stale = len(stale_by_source[s])
        if not stale or args.max_stale_frac >= 1:
            continue
        fresh = _count_fresh(client, s, cutoffs[s])
        frac = stale / (stale + fresh)
        if frac > args.max_stale_frac:
            logger.warning(
                f"  {s}: {stale:,} of {stale + fresh:,} active listings ({frac:.0%}) unseen since "
                f"the cutoff. That is a sweep that did not finish, not a week of delistings. "
                f"Skipping {s}; rerun with --max-stale-frac 1 to force."
            )
            print(f"::warning::mark_stale skipped {s}: {frac:.0%} of active listings unseen")
            stale_by_source[s] = []
    if args.backup and not dry_run:
        import csv
        with open(args.backup, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["id", "source", "is_active"])
            for s, ids in stale_by_source.items():
                w.writerows([i, s, True] for i in ids)
        logger.info(f"backup: {args.backup}")

    total_stale = 0
    for source, stale_ids in stale_by_source.items():
        stale = len(stale_ids)
        logger.info(f"  {source:12s}  stale={stale:>7,}")
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
        logger.info(f"\nDone. {total_stale} listings marked inactive across {len(cutoffs)} sources.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
