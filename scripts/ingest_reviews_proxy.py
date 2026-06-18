"""Free, proxy-parallel Google rating/review-count enrichment for condos.

The proxy-scraping counterpart to scripts/ingest_reviews.py (which uses the
paid Places API). Fans the work across PROXY_URLS endpoints with a thread pool,
each request leaving through a different proxy IP, then writes results on the
main thread (the Supabase client is single-threaded).

Writes the SAME columns as ingest_reviews.py:
  - condos.google_rating / .google_review_count / .google_reviews_fetched_at
  - condos.google_place_id  (scraped feature CID; may be NULL — see scraper docstring)
Review *text* is not scraped, so condo_reviews rows are left untouched (any
existing API-sourced reviews are preserved).

Usage:
  # Calibration smoke test — scrape 3 condos, save HTML, no DB writes:
  python scripts/ingest_reviews_proxy.py --limit 3 --dry-run --save-html debug_html
  python scripts/ingest_reviews_proxy.py --limit 100 --workers 8
  python scripts/ingest_reviews_proxy.py --refresh-days 90

Requires PROXY_URLS in env. SOCKS proxies also need:  pip install "httpx[socks]"
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.net.proxy_pool import ProxyPool  # noqa: E402
from src.scrapers.google_places_scrape import enrich_condo_via_scrape  # noqa: E402


def _candidates(client, limit: int, refresh_days: int) -> list[dict]:
    """Same selection strategy as ingest_reviews.py: never-fetched first,
    then rows older than refresh_days. Biased to hipflat condos (they carry
    province context for a tighter Google query)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=refresh_days)).isoformat()

    never = (
        client.table("condos")
        .select("id, name, latitude, longitude, province")
        .eq("source", "hipflat")
        .eq("is_active", True)
        .is_("google_reviews_fetched_at", "null")
        .not_.is_("name", "null")
        .order("last_seen_at", desc=True)
        .limit(limit)
        .execute()
        .data
    ) or []

    if len(never) >= limit:
        return never[:limit]

    stale = (
        client.table("condos")
        .select("id, name, latitude, longitude, province")
        .eq("source", "hipflat")
        .eq("is_active", True)
        .lt("google_reviews_fetched_at", cutoff)
        .not_.is_("name", "null")
        .order("google_reviews_fetched_at", desc=False)
        .limit(limit - len(never))
        .execute()
        .data
    ) or []

    return never + stale


def _scrape_one(pool: ProxyPool, condo: dict, save_dir: str | None, delay_s: float) -> tuple[dict, dict | None]:
    """Worker body (runs in a thread). Picks a proxy, scrapes, reports the
    proxy outcome, and paces itself. Returns (condo, result|None)."""
    proxy = pool.acquire()
    province = (condo.get("province") or "Bangkok").title()
    save_path = os.path.join(save_dir, f"{condo['id']}.html") if save_dir else None
    try:
        result = enrich_condo_via_scrape(
            condo["name"], proxy, city=province, save_html_path=save_path,
            lat=condo.get("latitude"), lng=condo.get("longitude"),
        )
    except Exception as e:  # noqa: BLE001 — never let one condo kill the pool
        logger.warning(f"  scrape crashed for {condo['name']!r}: {e}")
        result = None
    pool.report(proxy, result is not None)
    # Per-thread politeness: with N workers over N proxies this keeps each IP
    # well under Google's per-IP burst threshold.
    time.sleep(delay_s)
    return condo, result


def _persist(client, condo: dict, result: dict) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "google_rating": result.get("rating"),
        "google_review_count": result.get("review_count") or 0,
        "google_reviews_fetched_at": now,
    }
    # Only set place_id when scraped — don't clobber an existing API place_id
    # (ChIJ...) with NULL.
    if result.get("place_id"):
        payload["google_place_id"] = result["place_id"]
    try:
        client.table("condos").update(payload).eq("id", condo["id"]).execute()
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"  condos update failed for {condo['id']}: {e}")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50,
                    help="Max condos this run (default 50)")
    ap.add_argument("--refresh-days", type=int, default=90,
                    help="Also re-fetch condos whose rating is older than N days")
    ap.add_argument("--workers", type=int, default=None,
                    help="Concurrent scrapers (default: number of proxies)")
    ap.add_argument("--delay-s", type=float, default=2.0,
                    help="Per-worker sleep between requests (default 2.0)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Scrape but DON'T write to DB — use with --save-html to calibrate")
    ap.add_argument("--save-html", metavar="DIR", default=None,
                    help="Write each condo's raw HTML to DIR/<id>.html for parser tuning")
    args = ap.parse_args()

    pool = ProxyPool.from_env()
    workers = args.workers or len(pool)
    if args.save_html:
        os.makedirs(args.save_html, exist_ok=True)

    client = get_client()
    candidates = _candidates(client, args.limit, args.refresh_days)
    logger.info(
        f"Scraping {len(candidates)} condos across {len(pool)} proxies "
        f"({workers} workers){' [DRY RUN]' if args.dry_run else ''}"
    )
    if not candidates:
        logger.info("Nothing to enrich.")
        return 0

    matched = no_match = written = 0
    started = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = [
            ex.submit(_scrape_one, pool, c, args.save_html, args.delay_s)
            for c in candidates
        ]
        for i, fut in enumerate(as_completed(futures), 1):
            condo, result = fut.result()
            if not result:
                no_match += 1
                logger.info(f"  [{i}/{len(candidates)}] no match: {condo['name']!r}")
                continue
            matched += 1
            logger.info(
                f"  [{i}/{len(candidates)}] {condo['name']!r:40s} → "
                f"⭐ {result.get('rating')} ({result.get('review_count')} reviews)"
            )
            if not args.dry_run and _persist(client, condo, result):
                written += 1

    logger.info(
        f"Done in {(time.time()-started)/60:.1f}min. matched={matched} "
        f"no_match={no_match} "
        f"{'(dry-run, no writes)' if args.dry_run else f'written={written}'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
