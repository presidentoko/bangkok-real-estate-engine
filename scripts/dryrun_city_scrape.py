"""Dry-run city scrape — proves DotProperty city pagination works for
Chiang Mai, Phuket, Pattaya, Hua Hin (and any others passed via --cities)
WITHOUT writing to the database.

Pulls up to N listings per city × listing_type and prints a summary of
projects found, lat/lng coverage, and a sample. Use this before launching
a full ingest sweep.

Usage:
  python scripts/dryrun_city_scrape.py
  python scripts/dryrun_city_scrape.py --cities pattaya phuket --limit 20
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.scrapers.dotproperty import scrape

# Map DB province slug (used by the web app) → DotProperty URL slug.
# Most match; pattaya and hua-hin diverge from web app's "huahin"/"pattaya".
CITY_URL_SLUGS = {
    "chiangmai":  "chiang-mai",
    "phuket":     "phuket",
    "pattaya":    "pattaya",
    "huahin":     "hua-hin",
    "chonburi":   "chonburi",
    "samui":      "ko-samui",
    "chiangrai":  "chiang-rai",
    "krabi":      "krabi",
}


def run(cities: list[str], limit_per_type: int) -> None:
    print(
        f"\nDry-run: {len(cities)} cities × (sale, rent) × cap {limit_per_type}\n"
        + "=" * 72
    )

    total = Counter()
    per_city: dict[str, dict] = {}

    for city_db_slug in cities:
        url_slug = CITY_URL_SLUGS.get(city_db_slug, city_db_slug)
        per_city[city_db_slug] = {
            "url_slug": url_slug,
            "sale": 0,
            "rent": 0,
            "with_latlng": 0,
            "with_project": 0,
            "sample": None,
            "projects": set(),
        }

        for lt_key in ("sale_condo", "rent_condo"):
            label = "sale" if lt_key == "sale_condo" else "rent"
            print(f"\n[{city_db_slug:<10}] {label}  → /{url_slug}")
            count = 0
            for item in scrape(
                city=url_slug,
                listing_type_key=lt_key,
                max_listings=limit_per_type,
                delay_s=1.5,
            ):
                count += 1
                per_city[city_db_slug][label] += 1
                if item.get("latitude") is not None and item.get("longitude") is not None:
                    per_city[city_db_slug]["with_latlng"] += 1
                if item.get("project_name"):
                    per_city[city_db_slug]["with_project"] += 1
                    per_city[city_db_slug]["projects"].add(item["project_name"])
                if per_city[city_db_slug]["sample"] is None:
                    per_city[city_db_slug]["sample"] = item
                total[label] += 1
            print(f"           collected {count}")

    print("\n" + "=" * 72)
    print(f"{'CITY':<12} {'URL':<14} {'SALE':>6} {'RENT':>6} {'LAT/LNG':>9} {'PROJ':>6} {'UNIQ':>6}")
    print("-" * 72)
    for city, info in per_city.items():
        print(
            f"{city:<12} {info['url_slug']:<14} "
            f"{info['sale']:>6} {info['rent']:>6} "
            f"{info['with_latlng']:>9} {info['with_project']:>6} "
            f"{len(info['projects']):>6}"
        )
    print(f"\nTOTAL  sale={total['sale']} rent={total['rent']}")

    print("\nSample row per city (first listing scraped):")
    for city, info in per_city.items():
        s = info["sample"]
        if not s:
            print(f"\n  {city}: (none — scraper returned 0)")
            continue
        print(f"\n  {city}:")
        print(f"    project_name : {s.get('project_name')}")
        print(f"    name         : {s.get('name')}")
        print(f"    price        : {s.get('price')} {s.get('price_currency')}")
        print(f"    bedrooms     : {s.get('bedrooms')}")
        print(f"    lat/lng      : {s.get('latitude')}, {s.get('longitude')}")
        print(f"    locality     : {s.get('address_locality')}")
        print(f"    url          : {s.get('url')}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cities",
        nargs="+",
        default=["chiangmai", "phuket", "pattaya", "huahin"],
        help="DB province slugs (web app naming): chiangmai, phuket, pattaya, huahin, "
             "chonburi, samui, chiangrai, krabi",
    )
    ap.add_argument(
        "--limit", type=int, default=10,
        help="Max listings per city × listing_type (default 10)",
    )
    args = ap.parse_args()
    run(args.cities, args.limit)


if __name__ == "__main__":
    main()
