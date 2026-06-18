"""Long-running, self-pacing Google rating enrichment across ALL condo sources.

Built for an unattended multi-hour run: it spreads every un-enriched condo
evenly across a --hours budget so the proxy IPs stay well under Google's
per-IP burst threshold, stamps misses so the queue always advances, and is
fully resumable (google_reviews_fetched_at is the progress marker — just
re-run to continue where it stopped).

Pacing is automatic: each batch it recomputes the per-worker delay from
(time left, workers, condos remaining), so the job lands close to --hours no
matter how many condos are left.

Writes the same columns as scripts/ingest_reviews.py:
  - matches: google_rating, google_review_count, google_place_id, _fetched_at
  - misses : _fetched_at only (rating stays NULL = "looked, found nothing")

Usage:
  python scripts/run_reviews_proxy_loop.py --hours 20
  python scripts/run_reviews_proxy_loop.py --hours 20 --sources hipflat fazwaz
  python scripts/run_reviews_proxy_loop.py --hours 2 --dry-run     # rehearse pacing

Requires PROXY_URLS in env. SOCKS proxies also need:  pip install "httpx[socks]"
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.net.proxy_pool import ProxyPool  # noqa: E402
from src.scrapers.google_places_scrape import (  # noqa: E402
    ScrapeFetchError,
    enrich_condo_via_scrape,
)

ALL_SOURCES = ["hipflat", "fazwaz", "ddproperty", "dotproperty"]
BATCH = 200                # condos pulled + processed per loop iteration
MIN_DELAY_S = 1.0          # never hammer a single IP faster than this
MAX_DELAY_S = 90.0         # if hugely over-budgeted, don't stall pointlessly
EST_FETCH_S = 3.0          # rough fetch time, subtracted from the target gap
MAX_FETCH_TRIES = 6        # rotate through this many proxies before giving up


def _remaining_count(client, sources: list[str]) -> int:
    return (
        client.table("condos").select("id", count="exact")
        .eq("is_active", True).in_("source", sources)
        .is_("google_reviews_fetched_at", "null").not_.is_("name", "null")
        .limit(1).execute().count
    ) or 0


def _next_batch(client, sources: list[str], n: int, after_id: str) -> list[dict]:
    """Keyset pagination by id. Ordering by id (not last_seen) means condos left
    un-stamped by proxy failures sit BELOW the advancing cursor and are simply
    skipped this run (retried next run) instead of piling up at the top of a
    last_seen-ordered window and starving fresh candidates."""
    q = (
        client.table("condos")
        .select("id, name, province, latitude, longitude")
        .eq("is_active", True).in_("source", sources)
        .is_("google_reviews_fetched_at", "null").not_.is_("name", "null")
        .order("id", desc=False)
        .limit(n)
    )
    if after_id:
        q = q.gt("id", after_id)
    return q.execute().data or []


def _scrape(pool: ProxyPool, condo: dict, delay: float, deadline: float) -> tuple[dict, dict | None, bool]:
    """Returns (condo, result, resolved).

    resolved=True  -> fetch succeeded; result is the rating dict (match) or None
                      (genuine no-rating). Caller persists/stamps it.
    resolved=False -> every proxy attempt failed or we're past the deadline; the
                      condo is left un-stamped so a later run retries it.

    The per-worker sleep lives HERE (not the main thread) — that's what paces
    each proxy. Retries rotate proxies via the pool, so a few dead NordVPN
    tunnels don't turn into false misses."""
    province = (condo.get("province") or "Bangkok").title()
    for _ in range(MAX_FETCH_TRIES):
        if time.time() >= deadline:
            return condo, None, False
        proxy = pool.acquire()
        try:
            res = enrich_condo_via_scrape(
                condo["name"], proxy, city=province,
                lat=condo.get("latitude"), lng=condo.get("longitude"),
            )
            pool.report(proxy, True)          # fetch worked (match or genuine miss)
            if time.time() < deadline:
                time.sleep(delay)
            return condo, res, True
        except ScrapeFetchError:
            pool.report(proxy, False)         # dead/blocked proxy — try another
            continue
        except Exception as e:  # noqa: BLE001 — parse bug etc.: don't spin, stamp miss
            logger.warning(f"  scrape crashed {condo['name']!r}: {e}")
            pool.report(proxy, False)
            if time.time() < deadline:
                time.sleep(delay)
            return condo, None, True
    return condo, None, False  # all proxies failed this round


def _persist(client, condo: dict, res: dict | None) -> None:
    """Match → write rating; miss → stamp fetched_at only (advances queue)."""
    now = datetime.now(timezone.utc).isoformat()
    payload = {"google_reviews_fetched_at": now}
    if res:
        payload["google_rating"] = res.get("rating")
        payload["google_review_count"] = res.get("review_count") or 0
        if res.get("place_id"):
            payload["google_place_id"] = res["place_id"]
    try:
        client.table("condos").update(payload).eq("id", condo["id"]).execute()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"  DB write failed {condo['id']}: {e}")


def _paced_delay(remaining: int, seconds_left: float, workers: int) -> float:
    """Per-worker sleep so `remaining` condos spread over `seconds_left`."""
    if remaining <= 0 or seconds_left <= 0:
        return MIN_DELAY_S
    target_gap = seconds_left * workers / remaining   # wall-secs each worker gets per condo
    return max(MIN_DELAY_S, min(MAX_DELAY_S, target_gap - EST_FETCH_S))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=20.0,
                    help="Wall-clock budget; pacing fills it (default 20)")
    ap.add_argument("--sources", nargs="+", default=ALL_SOURCES,
                    choices=ALL_SOURCES, help="Condo sources to enrich")
    ap.add_argument("--workers", type=int, default=None,
                    help="Concurrent scrapers (default: number of proxies)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Scrape + pace but never write to DB (queue won't advance)")
    args = ap.parse_args()

    pool = ProxyPool.from_env()
    workers = args.workers or len(pool)
    client = get_client()

    deadline = time.time() + args.hours * 3600
    total_remaining = _remaining_count(client, args.sources)
    logger.info(
        f"Loop start: {total_remaining} condos to enrich over {args.hours}h "
        f"across {len(pool)} proxies ({workers} workers)"
        f"{' [DRY RUN — no writes, will repeat same batch]' if args.dry_run else ''}"
    )
    if not total_remaining:
        logger.info("Nothing to enrich. Done.")
        return 0

    matched = missed = unresolved = processed = 0
    cursor = ""                   # keyset pagination: last id seen this pass
    pass_no = 1
    resolved_this_pass = 0        # stamped (matched+missed) since cursor reset
    started = time.time()
    batch_no = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        while time.time() < deadline:
            remaining = _remaining_count(client, args.sources)
            if remaining <= 0:
                logger.info("Queue drained — every condo enriched. Done early.")
                break
            batch = _next_batch(client, args.sources, BATCH, cursor)
            if not batch:
                # End of a pass. If condos remain un-stamped (proxy failures)
                # and we made progress this pass, reset the cursor and retry
                # them with the leftover time budget. Bail if a whole pass
                # resolved nothing (the proxy fleet is down — no point looping).
                if remaining > 0 and resolved_this_pass > 0 and not args.dry_run:
                    logger.info(
                        f"End of pass {pass_no}: {remaining} still un-stamped — "
                        f"resetting cursor to retry them."
                    )
                    cursor = ""; pass_no += 1; resolved_this_pass = 0
                    continue
                logger.info("Reached end of queue. Done.")
                break
            cursor = batch[-1]["id"]   # advance past this batch regardless of outcome
            delay = _paced_delay(remaining, deadline - time.time(), workers)
            batch_no += 1
            logger.info(
                f"[batch {batch_no}] {len(batch)} condos | {remaining} left | "
                f"pace={delay:.1f}s/worker | elapsed={(time.time()-started)/3600:.2f}h "
                f"| matched={matched} missed={missed} unresolved={unresolved}"
            )

            futures = [ex.submit(_scrape, pool, c, delay, deadline) for c in batch]
            for fut in as_completed(futures):
                condo, res, resolved = fut.result()
                if not resolved:
                    unresolved += 1   # proxy failure / past deadline — not stamped
                    continue
                if res and res.get("rating") is not None:
                    matched += 1
                else:
                    missed += 1
                processed += 1
                resolved_this_pass += 1
                if not args.dry_run:
                    _persist(client, condo, res)

            if args.dry_run:
                logger.info("[dry-run] stopping after one batch (queue won't advance).")
                break

    logger.info(
        f"Loop end. processed={processed} matched={matched} missed={missed} "
        f"unresolved={unresolved} in {(time.time()-started)/3600:.2f}h. "
        f"Re-run to continue (resumes from google_reviews_fetched_at)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
