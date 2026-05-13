"""Smoke test: pull N listings from DotProperty via JSON-LD and print
a summary so we can verify selectors/coverage before adding a DB pipeline.

Usage:
  python scripts/test_dotproperty.py [N]   (default N=60 = ~2 pages)
"""
from __future__ import annotations

import io
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.scrapers.dotproperty import scrape  # noqa: E402


def main() -> None:
    cap = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    print(f"Pulling up to {cap} DotProperty listings...\n")
    rows = list(scrape(max_listings=cap, delay_s=0.5))

    for i, r in enumerate(rows[:3], 1):
        print(f"--- listing {i} (id {r['source_listing_id']}) ---")
        print(f"  project : {r['project_name']}")
        print(f"  name    : {(r['name'] or '')[:80]}")
        print(f"  bedrooms: {r['bedrooms']}")
        print(f"  district: {r['address_locality']}")
        print(f"  geo     : ({r['latitude']}, {r['longitude']})")
        if r["price"]:
            print(f"  price   : {r['price']:,.0f} {r['price_currency']}")
        else:
            print(f"  price   : -")
        print(f"  posted  : {r['date_posted']}")
        print(f"  url     : {r['url'][:120]}")
        print()

    print(f"=== SUMMARY across {len(rows)} listings ===")
    print(f"  with geo (lat/lng): {sum(1 for r in rows if r['latitude'])}")
    print(f"  with price        : {sum(1 for r in rows if r['price'])}")
    print(f"  with project_name : {sum(1 for r in rows if r['project_name'])}")
    print(f"  with date_posted  : {sum(1 for r in rows if r['date_posted'])}")
    print(f"  with bedrooms     : {sum(1 for r in rows if r['bedrooms'] is not None)}")
    dup_ids = len(rows) - len({r["source_listing_id"] for r in rows})
    print(f"  duplicate IDs     : {dup_ids}")

    districts = Counter(r["address_locality"] for r in rows if r["address_locality"])
    print(f"\n  top districts ({len(districts)} unique):")
    for d, n in districts.most_common(10):
        print(f"    {n:>3} x {d}")

    projects = Counter(r["project_name"] for r in rows if r["project_name"])
    print(f"\n  unique projects: {len(projects)}")
    print(f"  top 5 most-listed:")
    for p, n in projects.most_common(5):
        print(f"    {n:>3} x {(p or '')[:70]}")


if __name__ == "__main__":
    main()
