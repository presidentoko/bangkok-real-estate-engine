"""DotProperty Thailand-wide city sweep — sale + rent for every known city slug.

Runs cities sequentially (polite). Skips a city if the first page returns 0
listings (not in DotProperty's index). Logs a summary table at the end.

Usage:
  python scripts/sweep_dotproperty_thailand.py [--dry-run]
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

from loguru import logger

from src.db import (
    _normalize_project_name,
    build_hipflat_name_index,
    get_client,
    upsert_dotproperty_condo,
    upsert_dotproperty_listing,
)
from src.scrapers.dotproperty import scrape

# All candidate city slugs — DotProperty silently returns 0 results for
# unknown cities so no harm trying extras.
CITIES = [
    # Central / Greater Bangkok
    "nonthaburi", "pathum-thani", "samut-prakan", "nakhon-pathom",
    "samut-sakhon", "samut-songkhram",
    # East
    "rayong", "chanthaburi", "trat",
    # West
    "kanchanaburi", "ratchaburi",
    # North
    "chiang-rai", "lampang", "lamphun", "nan", "phrae", "mae-hong-son",
    "phayao", "tak",
    # Northeast
    "nakhon-ratchasima", "khon-kaen", "udon-thani", "ubon-ratchathani",
    "buriram", "surin", "sisaket", "roi-et", "maha-sarakham",
    # South
    "surat-thani", "ko-samui", "nakhon-si-thammarat", "songkhla",
    "phang-nga", "krabi", "trang", "satun", "phatthalung", "yala",
    "pattani", "narathiwat", "ranong",
    # Central other
    "prachuap-khiri-khan", "phetchaburi", "lopburi",
    "saraburi", "nakhon-nayok", "prachinburi", "chachoengsao",
    "ang-thong", "sing-buri", "chai-nat", "suphan-buri",
]

LISTING_TYPES = ["sale_condo", "rent_condo"]


def ingest_city(client, name_idx, dp_condo_cache, city, listing_type_key, dry_run):
    stats = Counter()
    first_page_seen = False

    for item in scrape(city=city, listing_type_key=listing_type_key, delay_s=2.0):
        if not first_page_seen:
            first_page_seen = True

        stats["seen"] += 1
        project_name = item.get("project_name")
        if not project_name:
            stats["no_project_name"] += 1
            continue

        if dry_run:
            stats["listings_upserted"] += 1
            continue

        key = _normalize_project_name(project_name)
        if key in name_idx:
            condo_id = name_idx[key]
            stats["matched_hipflat"] += 1
        elif key in dp_condo_cache:
            condo_id = dp_condo_cache[key]
            stats["unmatched_existing_dp"] += 1
        else:
            try:
                condo_id = upsert_dotproperty_condo(client, project_name, item)
            except Exception as e:
                logger.warning(f"upsert_condo failed {project_name!r}: {e}")
                stats["condo_upsert_failed"] += 1
                continue
            dp_condo_cache[key] = condo_id
            stats["unmatched_new_dp"] += 1

        try:
            upsert_dotproperty_listing(client, condo_id, item)
            stats["listings_upserted"] += 1
        except Exception as e:
            logger.warning(f"upsert_listing failed: {e}")
            stats["listing_upsert_failed"] += 1

    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    logger.info("Building hipflat name index...")
    name_idx = build_hipflat_name_index(client)
    logger.info(f"  {len(name_idx)} hipflat condos")

    dp_condo_cache: dict[str, str] = {}
    summary: list[dict] = []
    total_start = time.time()

    for city in CITIES:
        for ltk in LISTING_TYPES:
            label = f"{city}/{ltk.split('_')[0]}"
            logger.info(f"=== {label} ===")
            t0 = time.time()
            try:
                stats = ingest_city(client, name_idx, dp_condo_cache, city, ltk, args.dry_run)
            except Exception as e:
                logger.error(f"{label} failed: {e}")
                stats = Counter({"error": 1})
            elapsed = time.time() - t0
            upserted = stats.get("listings_upserted", 0)
            logger.info(f"  {label}: {upserted} upserted in {elapsed:.0f}s — {dict(stats)}")
            summary.append({"city": city, "type": ltk.split("_")[0],
                            "upserted": upserted, "elapsed_s": elapsed, **stats})

    total_elapsed = time.time() - total_start
    logger.info(f"\n{'='*60}")
    logger.info(f"SWEEP DONE in {total_elapsed/60:.1f} min")
    logger.info(f"{'city':<25} {'type':<6} {'upserted':>9}")
    logger.info(f"{'-'*44}")
    for r in summary:
        if r["upserted"] > 0:
            logger.info(f"{r['city']:<25} {r['type']:<6} {r['upserted']:>9}")
    total_upserted = sum(r["upserted"] for r in summary)
    logger.info(f"{'TOTAL':<25} {'':6} {total_upserted:>9}")


if __name__ == "__main__":
    main()
