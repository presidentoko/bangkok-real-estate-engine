"""FazWaz project-page Foreign Quota inventory ingest.

For each FazWaz condo with a project URL, fetch the project page and count
how many for-sale units carry "Foreign Quota" vs "Thai Quota" labels. Writes
back to:
  - condos.foreign_quota_listings_available
  - condos.thai_quota_listings_available
  - condos.total_quota_listings_observed
  - condos.foreign_quota_inventory_pct
  - condos.foreign_quota_fetched_at

High foreign_quota_inventory_pct = lots of foreign-eligible inventory still
on sale = the building isn't capped out — useful signal for foreign buyers.

Uses the same nodriver profile (.nodriver-profile-fazwaz/) as ingest_fazwaz.

Usage:
  python scripts/ingest_foreign_quota.py                   # full sweep
  python scripts/ingest_foreign_quota.py --limit 30
  python scripts/ingest_foreign_quota.py --refresh-days 30
  python scripts/ingest_foreign_quota.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys
import time
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
    """FazWaz condos with a project URL, prioritising never-fetched then stale.
    Paginates explicitly — PostgREST caps single responses at 1000 rows."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=refresh_days)).isoformat()

    def _paginate(base_query, cap: int | None) -> list[dict]:
        out: list[dict] = []
        offset = 0
        page_size = 1000
        while True:
            if cap is not None and len(out) >= cap:
                return out[:cap]
            this_page = page_size
            if cap is not None:
                this_page = min(page_size, cap - len(out))
            batch = (
                base_query.range(offset, offset + this_page - 1).execute().data
            ) or []
            out.extend(batch)
            if len(batch) < this_page:
                return out
            offset += this_page

    never_q = (
        client.table("condos")
        .select("id, name, url")
        .eq("source", "fazwaz")
        .not_.is_("url", "null")
        .is_("foreign_quota_fetched_at", "null")
        .eq("is_active", True)
        .order("last_seen_at", desc=True)
    )
    never = _paginate(never_q, limit)

    if limit and len(never) >= limit:
        return never[:limit]

    remaining = (limit - len(never)) if limit else None
    stale_q = (
        client.table("condos")
        .select("id, name, url")
        .eq("source", "fazwaz")
        .not_.is_("url", "null")
        .lt("foreign_quota_fetched_at", cutoff)
        .eq("is_active", True)
        .order("foreign_quota_fetched_at", desc=False)
    )
    stale = _paginate(stale_q, remaining)
    return never + stale


async def run(limit: int | None, refresh_days: int, delay_s: float, dry_run: bool) -> int:
    client = get_client()
    cands = _candidates(client, limit, refresh_days)
    logger.info(f"Foreign-Quota sweep: {len(cands)} FazWaz condos to enrich")
    if not cands:
        return 0

    os.makedirs(PROFILE_DIR, exist_ok=True)
    browser = await uc.start(headless=False, user_data_dir=PROFILE_DIR, sandbox=True)

    now_iso = datetime.now(timezone.utc).isoformat()
    written = 0
    failed = 0
    started = time.time()
    try:
        for i, cd in enumerate(cands, 1):
            url = cd["url"]
            stats = await fetch_project_quota(browser, url)
            if stats is None:
                failed += 1
                logger.warning(f"  [{i}/{len(cands)}] '{cd['name']}' → fetch failed")
                await asyncio.sleep(delay_s)
                continue

            logger.info(
                f"  [{i}/{len(cands)}] '{cd['name'][:38]}' → "
                f"foreign={stats['foreign']:>2} thai={stats['thai']:>2} "
                f"labeled={stats['labeled']:>2} foreign_pct={stats['foreign_pct']}"
            )

            if not dry_run:
                client.table("condos").update({
                    "foreign_quota_listings_available": stats["foreign"],
                    "thai_quota_listings_available": stats["thai"],
                    "total_quota_listings_observed": stats["total"],
                    "foreign_quota_inventory_pct": stats["foreign_pct"],
                    "foreign_quota_fetched_at": now_iso,
                }).eq("id", cd["id"]).execute()
                written += 1
            await asyncio.sleep(delay_s)
    finally:
        try:
            browser.stop()
        except Exception:
            pass

    elapsed_min = (time.time() - started) / 60
    logger.info(
        f"Done. matched={len(cands) - failed} failed={failed} written={written} "
        f"elapsed={elapsed_min:.1f}min"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="Cap rows touched this run (default: all candidates)")
    ap.add_argument("--refresh-days", type=int, default=30,
                    help="Re-pull rows older than N days (default 30, quota changes slowly)")
    ap.add_argument("--delay-s", type=float, default=8.0,
                    help="Sleep between project pages (FazWaz is CF-guarded — keep this polite)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Fetch + parse but don't write to DB")
    args = ap.parse_args()
    return asyncio.run(run(args.limit, args.refresh_days, args.delay_s, args.dry_run))


if __name__ == "__main__":
    raise SystemExit(main())
