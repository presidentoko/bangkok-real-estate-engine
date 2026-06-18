"""Backfill province for FazWaz + DDProperty rows that defaulted to 'bangkok'.

These two scrapers don't always populate `sample.province` so the upsert
defaults to 'bangkok' — leaving rows like "Patta Ville, Nong Prue, Pattaya"
sitting in the Bangkok bucket. We infer the city from address (FazWaz) and
name (DDProperty) using simple keyword matching.

Conventions: store the DotProperty/hipflat kebab form (e.g. 'chon-buri',
'chiang-mai', 'hua-hin', 'ko-samui') so frontend cityProvinceSlugs() aliases
pick them up.

Usage:
  python scripts/backfill_province.py             # writes
  python scripts/backfill_province.py --dry-run   # just report
"""
from __future__ import annotations

import argparse
import io
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import get_client


# Order matters: more specific patterns first. We look at lowercased
# address + name + url to decide the city. Keys are the DB province values
# to write. Frontend lib/cities.ts cityProvinceSlugs() aliases both compact
# and kebab forms back to one UI slug, so consistency between the two forms
# is not critical here — what IS critical is that Pattaya rows land in a
# different province bucket than Chonburi proper (Sriracha / Bang Saen),
# because the UI exposes those as separate cities.
CITY_PATTERNS: list[tuple[str, list[str]]] = [
    # Pattaya keywords first — these would otherwise match "chon-buri" since
    # Pattaya is administratively in Chon Buri province.
    ("pattaya",    ["pattaya", "naklua", "na kluea", "nong prue", "bang lamung",
                     "jomtien", "jomtian"]),
    # Chonburi proper (non-Pattaya parts of the province).
    ("chon-buri",  ["sriracha", "si racha", "bang saen", "bangsaen",
                     "chonburi", "chon buri"]),
    # Hua Hin keywords — also handles Cha-am which is administratively in
    # Phetchaburi but reads as Hua Hin to most foreign buyers.
    ("hua-hin",    ["hua hin", "hua-hin", "huahin", "cha-am", "cha am", "cha am"]),
    ("phuket",     ["phuket", "patong", "kata", "karon", "rawai", "kamala",
                     "nai harn", "bang tao", "surin beach"]),
    ("chiang-mai", ["chiang mai", "chiangmai", "chiang-mai", "doi saket",
                     "mae rim", "hang dong", "san sai", "san kamphaeng"]),
    ("krabi",      ["krabi", "ao nang", "railay"]),
    ("ko-samui",   ["koh samui", "ko samui", "ko-samui", "koh-samui", "samui",
                     "chaweng", "lamai", "bophut", "maenam"]),
    ("chiang-rai", ["chiang rai", "chiang-rai", "chiangrai"]),
    ("nonthaburi", ["nonthaburi", "nontha buri"]),
    ("samut-prakan", ["samut prakan", "samut-prakan", "samutprakan"]),
    ("rayong",     ["rayong"]),
]


def infer_province(name: str, address: str | None, url: str | None) -> str | None:
    hay = " ".join(filter(None, [name.lower(), (address or "").lower(), (url or "").lower()]))
    for prov, patterns in CITY_PATTERNS:
        for p in patterns:
            if p in hay:
                return prov
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--sources", nargs="+", default=["fazwaz", "ddproperty"],
        choices=["fazwaz", "ddproperty", "dotproperty"],
    )
    ap.add_argument(
        "--from-provinces", nargs="+", default=["bangkok", "chon-buri"],
        help="Existing province values to re-evaluate. Defaults sweep the "
             "biggest mis-tagging buckets (Bangkok default + chon-buri that "
             "should be Pattaya).",
    )
    args = ap.parse_args()

    client = get_client()

    # Pass 1: ensure every non-bangkok row is published. The pre-2026 ingest
    # set `published=false` for non-Bangkok rows as a soft gate — the city
    # pages query the base `condos` table to preview them. The new inventory
    # page goes through `condos_published`, so the gate now just hides data.
    # Flip everything that's actually in a known UI city to published=true.
    PUBLISHED_PROVINCES = [
        "pattaya", "phuket", "chiang-mai", "hua-hin",
        "chon-buri", "krabi", "ko-samui", "chiang-rai",
        # Compact-form duplicates in case hipflat ingest used them too.
        "chiangmai", "huahin", "chonburi", "samui", "chiangrai",
    ]
    if not args.dry_run:
        print("\n=== publishing all known-city rows ===")
        total_published = 0
        for prov in PUBLISHED_PROVINCES:
            r = (
                client.table("condos")
                .update({"published": True})
                .eq("province", prov)
                .eq("published", False)
                .execute()
            )
            if r.data:
                total_published += len(r.data)
                print(f"  {prov:<22} +{len(r.data)} published")
        print(f"  total flipped: {total_published}")

    grand = Counter()
    for src in args.sources:
        print(f"\n=== {src} ===")
        # Walk every row currently tagged with any of --from-provinces and
        # re-evaluate. A row that already matches its current province stays
        # put; one whose keywords now point elsewhere gets moved.
        page_size = 1000
        per_city = Counter()
        unmoved = 0
        for current_prov in args.from_provinces:
            offset = 0
            while True:
                r = (
                    client.table("condos")
                    .select("id, name, address, url, province")
                    .eq("source", src)
                    .eq("province", current_prov)
                    .range(offset, offset + page_size - 1)
                    .execute()
                )
                rows = r.data or []
                if not rows:
                    break
                for row in rows:
                    new_prov = infer_province(
                        row.get("name") or "", row.get("address"), row.get("url")
                    )
                    if not new_prov or new_prov == current_prov:
                        unmoved += 1
                        continue
                    per_city[new_prov] += 1
                    if not args.dry_run:
                        client.table("condos").update(
                            {"province": new_prov, "published": new_prov != "bangkok"}
                        ).eq("id", row["id"]).execute()
                offset += page_size
                if len(rows) < page_size:
                    break

        total_moved = sum(per_city.values())
        print(f"  scanned bangkok-tagged: {total_moved + unmoved}")
        print(f"  re-tagged              : {total_moved}{' (dry-run)' if args.dry_run else ''}")
        print(f"  stayed bangkok         : {unmoved}")
        for prov, n in per_city.most_common():
            print(f"    → {prov:<22} {n:>5}")
        grand[src] = total_moved

    print(f"\nTotal re-tagged across sources: {sum(grand.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
