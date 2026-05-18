"""Fetch WAQI air-quality data (AQI + PM2.5) for every condo with lat/lng.

For each condo, queries the nearest WAQI monitoring station via geo:lat;lng
and stores: aqi_score, pm25_value, aqi_station_name, aqi_fetched_at.

Refreshes are cheap (WAQI free tier allows 1000 req/s) — defaults to a
1-req/sec polite cadence. Run weekly.

Usage:
  python scripts/ingest_pm25.py                   # full sweep
  python scripts/ingest_pm25.py --limit 50        # first 50 condos
  python scripts/ingest_pm25.py --refresh-days 7  # re-pull stale rows
  python scripts/ingest_pm25.py --dry-run

Requires WAQI_TOKEN in env. Get one free at:
  https://aqicn.org/data-platform/token/
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.waqi import fetch_aqi  # noqa: E402


def _candidates(client, limit: int | None, refresh_days: int) -> list[dict]:
    """Pick condos with lat/lng that haven't been fetched recently.

    PostgREST caps a single response at 1000 rows regardless of .range() —
    paginate explicitly when no --limit is set.
    """
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

    # Never-fetched first.
    never_q = (
        client.table("condos")
        .select("id, name, latitude, longitude, province")
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .is_("aqi_fetched_at", "null")
        .eq("is_active", True)
        .order("last_seen_at", desc=True)
    )
    never = _paginate(never_q, limit)

    if limit and len(never) >= limit:
        return never[:limit]

    remaining = (limit - len(never)) if limit else None
    stale_q = (
        client.table("condos")
        .select("id, name, latitude, longitude, province")
        .not_.is_("latitude", "null")
        .not_.is_("longitude", "null")
        .lt("aqi_fetched_at", cutoff)
        .eq("is_active", True)
        .order("aqi_fetched_at", desc=False)
    )
    stale = _paginate(stale_q, remaining)

    return never + stale


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="Cap rows touched this run (default: all candidates)")
    ap.add_argument("--refresh-days", type=int, default=7,
                    help="Re-pull rows older than N days (default 7)")
    ap.add_argument("--delay-s", type=float, default=0.6,
                    help="Sleep between condos (WAQI tolerates 1000 req/s, default 0.6 is polite)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Hit the API but don't write — useful for token validation")
    args = ap.parse_args()

    client = get_client()
    candidates = _candidates(client, args.limit, args.refresh_days)
    logger.info(f"AQI sweep: {len(candidates)} condos with lat/lng to enrich")

    if not candidates:
        logger.info("Nothing to fetch.")
        return 0

    written = 0
    matched = 0
    no_match = 0
    with httpx.Client() as http:
        for i, c in enumerate(candidates, 1):
            try:
                res = fetch_aqi(http, float(c["latitude"]), float(c["longitude"]))
            except RuntimeError as e:
                logger.error(f"  fatal: {e}")
                return 2
            except Exception as e:
                logger.warning(f"  [{i}] {c['name']!r}: {e}")
                res = None

            if not res or res.get("aqi") is None:
                no_match += 1
                logger.debug(f"  [{i}/{len(candidates)}] no AQI for {c['name']!r}")
                time.sleep(args.delay_s)
                continue

            matched += 1
            if i % 25 == 0 or i == len(candidates):
                logger.info(
                    f"  [{i}/{len(candidates)}] {c['name'][:40]!r:42s} → "
                    f"AQI {res['aqi']}  PM2.5 {res.get('pm25')}  "
                    f"station={res.get('station_name','?')[:40]}"
                )

            if args.dry_run:
                time.sleep(args.delay_s)
                continue

            now = datetime.now(timezone.utc).isoformat()
            try:
                client.table("condos").update({
                    "aqi_score": res["aqi"],
                    "pm25_value": res.get("pm25"),
                    "aqi_station_name": res.get("station_name"),
                    "aqi_fetched_at": now,
                }).eq("id", c["id"]).execute()
                written += 1
            except Exception as e:
                logger.warning(f"  DB write failed for {c['id']}: {e}")

            time.sleep(args.delay_s)

    logger.info(
        f"Done. matched={matched} no_match={no_match} "
        f"{'(dry-run, no DB writes)' if args.dry_run else f'written={written}'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
