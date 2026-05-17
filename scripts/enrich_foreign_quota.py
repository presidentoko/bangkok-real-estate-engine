"""Enrich each FazWaz condo with foreign-quota inventory share.

For every fazwaz condo whose `url` points at a /projects/... page,
fetches that page via the persistent nodriver profile, counts
Thai vs Foreign Quota labels in the project's available-units list,
and stores the breakdown + percentage.

This is a slow sweep — each fetch is ~10-15s via headed browser.
At default 12s delay → 600 condos × ~15s = ~150 min. Use --limit
for incremental runs.

Usage:
  python scripts/enrich_foreign_quota.py --limit 50           # smoke
  python scripts/enrich_foreign_quota.py                       # all
  python scripts/enrich_foreign_quota.py --refresh-days 30     # also re-pull stale
  python scripts/enrich_foreign_quota.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys
import time
from collections import Counter
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.fazwaz_project import fetch_project_quota  # noqa: E402

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile-fazwaz")


def _candidates(client, limit: int | None, refresh_days: int) -> list[dict]:
    """FazWaz condos that have a /projects/ URL we can scrape."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=refresh_days)).isoformat()

    never_q = (
        client.table("condos")
        .select("id, name, url")
        .eq("source", "fazwaz")
        .like("url", "%/projects/%")
        .is_("foreign_quota_fetched_at", "null")
        .order("last_seen_at", desc=True)
    )
    if limit:
        never_q = never_q.limit(limit)
    else:
        never_q = never_q.range(0, 4999)
    never = never_q.execute().data or []

    if limit and len(never) >= limit:
        return never[:limit]

    remaining = (limit - len(never)) if limit else 4000
    stale = (
        client.table("condos")
        .select("id, name, url")
        .eq("source", "fazwaz")
        .like("url", "%/projects/%")
        .lt("foreign_quota_fetched_at", cutoff)
        .order("foreign_quota_fetched_at", desc=False)
        .limit(remaining)
        .execute()
        .data
    ) or []
    return never + stale


async def run(limit: int | None, refresh_days: int, delay_s: float, dry_run: bool) -> int:
    client = get_client()
    candidates = _candidates(client, limit, refresh_days)
    logger.info(f"quota sweep: {len(candidates)} fazwaz condos with project URL")
    if not candidates:
        return 0

    os.makedirs(PROFILE_DIR, exist_ok=True)
    browser = await uc.start(headless=False, user_data_dir=PROFILE_DIR, sandbox=True)

    stats = Counter()
    written = 0
    started = time.time()

    try:
        for i, c in enumerate(candidates, 1):
            url = c["url"]
            try:
                res = await fetch_project_quota(browser, url)
            except Exception as e:
                logger.warning(f"  [{i}] {c['name']!r}: {e}")
                stats["error"] += 1
                continue
            if not res:
                stats["no_data"] += 1
                continue
            if res.get("labeled", 0) == 0:
                stats["unlabeled_only"] += 1
                # Still record a fetched_at so we don't re-pull soon.
                if not dry_run:
                    client.table("condos").update({
                        "total_quota_listings_observed": res.get("total"),
                        "foreign_quota_fetched_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", c["id"]).execute()
                continue

            stats["ok"] += 1
            if i % 10 == 0 or i <= 5 or i == len(candidates):
                logger.info(
                    f"  [{i}/{len(candidates)}] {c['name'][:40]!r:42s} → "
                    f"foreign={res['foreign']:>2}  thai={res['thai']:>2}  "
                    f"({res['foreign_pct']}% foreign of labeled)  "
                    f"elapsed={(time.time()-started)/60:.1f}min"
                )

            if dry_run:
                continue

            try:
                client.table("condos").update({
                    "foreign_quota_listings_available": res["foreign"],
                    "thai_quota_listings_available": res["thai"],
                    "total_quota_listings_observed": res["total"],
                    "foreign_quota_inventory_pct": res["foreign_pct"],
                    "foreign_quota_fetched_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", c["id"]).execute()
                written += 1
            except Exception as e:
                logger.warning(f"  DB write failed for {c['id']}: {e}")

            await asyncio.sleep(delay_s)
    finally:
        browser.stop()

    elapsed = (time.time() - started) / 60
    logger.info(
        f"Done in {elapsed:.1f} min. {dict(stats)}  "
        f"{'(dry-run)' if dry_run else f'written={written}'}"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--refresh-days", type=int, default=30)
    ap.add_argument("--delay-s", type=float, default=8.0,
                    help="Seconds between project-page fetches (default 8s, FazWaz tolerance)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    return asyncio.run(run(args.limit, args.refresh_days, args.delay_s, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
