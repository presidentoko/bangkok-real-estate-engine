"""Ingest DotProperty Bangkok listings into Supabase.

For each listing pulled by src.scrapers.dotproperty.scrape():
  1. Try to match the listing's project_name to an existing hipflat condo
     (case- and punctuation-insensitive). If matched: use that condo_id.
  2. Otherwise: upsert a new condos row with source='dotproperty' so the
     project still gets a row we can attach the listing to.
  3. Upsert the listing into listings (source='dotproperty').

Usage:
  python scripts/ingest_dotproperty.py [--limit N] [--city bangkok]

Runs synchronously — DotProperty serves clean JSON-LD over plain HTTPS so
no browser is needed. Throughput is ~30 listings/page / ~1.3s/page →
roughly 1300 listings/min.
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import (  # noqa: E402
    build_hipflat_name_index,
    get_client,
    upsert_dotproperty_condo,
    upsert_dotproperty_listing,
    _normalize_project_name,
    _normalize_project_name_aggressive,
)
from src.scrapers.dotproperty import scrape  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="Stop after this many listings (default: full city)")
    ap.add_argument("--city", default="bangkok")
    ap.add_argument("--listing-type", choices=["sale", "rent", "both"], default="sale",
                    help="sale=condos-for-sale, rent=condos-for-rent, both=run sale then rent")
    ap.add_argument("--delay-s", type=float, default=1.0)
    ap.add_argument("--ingest-unmatched", action="store_true",
                    help="Also create new condos rows for unmatched DotProperty projects")
    args = ap.parse_args()

    listing_type_keys = {
        "sale": ["sale_condo"],
        "rent": ["rent_condo"],
        "both": ["sale_condo", "rent_condo"],
    }[args.listing_type]

    client = get_client()
    logger.info("Building hipflat condo name index...")
    name_idx = build_hipflat_name_index(client)
    logger.info(f"Indexed {len(name_idx)} hipflat condos by normalized name")

    # condo_id cache for unmatched DotProperty projects we create this run.
    dp_condo_cache: dict[str, str] = {}

    stats = Counter()
    started = time.time()

    def _items():
        for ltk in listing_type_keys:
            logger.info(f"Starting {ltk} scrape for city={args.city}")
            yield from scrape(city=args.city, listing_type_key=ltk,
                              max_listings=args.limit, delay_s=args.delay_s)

    for item in _items():
        stats["seen"] += 1
        project_name = item.get("project_name")
        if not project_name:
            stats["no_project_name"] += 1
            continue

        key = _normalize_project_name(project_name)
        akey = _normalize_project_name_aggressive(project_name)
        if key in name_idx:
            condo_id = name_idx[key]
            stats["matched_hipflat"] += 1
        elif akey and akey != key and akey in name_idx:
            condo_id = name_idx[akey]
            stats["matched_hipflat_aggressive"] += 1
        elif key in dp_condo_cache:
            condo_id = dp_condo_cache[key]
            stats["unmatched_existing_dp"] += 1
        elif not args.ingest_unmatched:
            stats["unmatched_skipped"] += 1
            continue
        else:
            try:
                condo_id = upsert_dotproperty_condo(client, project_name, item)
            except Exception as e:
                logger.warning(f"upsert_dotproperty_condo failed for {project_name!r}: {e}")
                stats["condo_upsert_failed"] += 1
                continue
            dp_condo_cache[key] = condo_id
            stats["unmatched_new_dp"] += 1

        try:
            upsert_dotproperty_listing(client, condo_id, item)
            stats["listings_upserted"] += 1
        except Exception as e:
            logger.warning(f"upsert_dotproperty_listing failed for {item.get('source_listing_id')}: {e}")
            stats["listing_upsert_failed"] += 1

        if stats["seen"] % 100 == 0:
            elapsed = time.time() - started
            rate = stats["seen"] / max(elapsed, 1)
            logger.info(
                f"progress  seen={stats['seen']}  "
                f"matched_hipflat={stats['matched_hipflat']}  "
                f"new_dp={stats['unmatched_new_dp']}  "
                f"listings={stats['listings_upserted']}  "
                f"rate={rate:.1f}/s"
            )

    elapsed = time.time() - started
    logger.info(f"DONE in {elapsed/60:.1f} min — {dict(stats)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
