"""Google Places (New) review enrichment for condos.

For each condo (default: missing google_reviews_fetched_at, ordered by
update activity), resolves a place_id via places:searchText, then fetches
rating + up to 5 reviews via places/{id}. Writes:
  - condos.google_place_id / .google_rating / .google_review_count / .google_reviews_fetched_at
  - condo_reviews (one row per returned review)

Requires GOOGLE_PLACES_API_KEY in env + migration 004_reviews.sql applied.

Usage:
  python scripts/ingest_reviews.py --limit 5 --dry-run     # smoke test (no DB write)
  python scripts/ingest_reviews.py --limit 50              # write 50 condos
  python scripts/ingest_reviews.py --refresh-days 90       # also refresh stale rows
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
from src.scrapers.google_reviews import enrich_condo  # noqa: E402


def _candidates(client, limit: int, refresh_days: int) -> list[dict]:
    """Pick condos to enrich. Strategy:
      1. Never-fetched first (google_reviews_fetched_at is null)
      2. Then ones older than refresh_days
    Both biased to hipflat condos which carry city/region context.
    """
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10,
                    help="Max condos to enrich this run (default 10 — keep small until you trust cost)")
    ap.add_argument("--refresh-days", type=int, default=90,
                    help="Re-fetch condos whose reviews are older than N days")
    ap.add_argument("--delay-s", type=float, default=0.5,
                    help="Sleep between condos (Places API New text search QPS ≈ 6)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Call the API but DON'T write to DB — useful for smoke-testing the key")
    args = ap.parse_args()

    client = get_client()
    candidates = _candidates(client, args.limit, args.refresh_days)
    logger.info(f"Enriching {len(candidates)} condos (limit={args.limit})")

    if not candidates:
        logger.info("Nothing to enrich.")
        return 0

    written = 0
    matched = 0
    no_match = 0
    with httpx.Client(timeout=30) as http:
        for i, c in enumerate(candidates, 1):
            province = (c.get("province") or "Bangkok").title()
            try:
                result = enrich_condo(
                    http,
                    c["name"],
                    lat=c.get("latitude"),
                    lng=c.get("longitude"),
                    city=province,
                )
            except RuntimeError as e:
                logger.error(f"  fatal: {e}")
                return 2
            except Exception as e:
                logger.warning(f"  enrich failed for {c['name']!r}: {e}")
                result = None

            if not result:
                no_match += 1
                logger.info(f"  [{i}/{len(candidates)}] no match: {c['name']!r}")
                time.sleep(args.delay_s)
                continue

            matched += 1
            logger.info(
                f"  [{i}/{len(candidates)}] {c['name']!r:40s} → "
                f"⭐ {result.get('rating')}  "
                f"({result.get('review_count')} reviews, "
                f"{len(result.get('reviews') or [])} returned)"
            )

            if args.dry_run:
                time.sleep(args.delay_s)
                continue

            now = datetime.now(timezone.utc).isoformat()
            # Update condos row
            try:
                client.table("condos").update({
                    "google_place_id": result["place_id"],
                    "google_rating": result.get("rating"),
                    "google_review_count": result.get("review_count") or 0,
                    "google_reviews_fetched_at": now,
                }).eq("id", c["id"]).execute()
            except Exception as e:
                logger.warning(f"  condos update failed for {c['id']}: {e}")
                continue

            # Replace condo_reviews rows for this condo (delete+insert)
            try:
                client.table("condo_reviews").delete().eq("condo_id", c["id"]).eq(
                    "source", "google"
                ).execute()
                rows = []
                for r in result.get("reviews") or []:
                    if not (r.get("text") or r.get("rating")):
                        continue
                    rows.append({
                        "condo_id": c["id"],
                        "source": "google",
                        "rating": r.get("rating"),
                        "review_text": r.get("text"),
                        "author": r.get("author"),
                        "published_at": r.get("published_at"),
                        "fetched_at": now,
                    })
                if rows:
                    client.table("condo_reviews").insert(rows).execute()
                written += 1
            except Exception as e:
                logger.warning(f"  condo_reviews write failed for {c['id']}: {e}")

            time.sleep(args.delay_s)

    logger.info(
        f"Done. matched={matched} no_match={no_match} "
        f"{'(dry-run, no DB writes)' if args.dry_run else f'written={written}'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
