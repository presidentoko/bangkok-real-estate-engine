"""Check our station rent medians against BKK Radar's, and map our gaps.

Why a second source matters here
--------------------------------
Every data error this project has shipped was found by comparing a number to
something else: the bubble index was rent/sale-mixed, market_sale_per_sqm was
USD printed as baht and copied across a whole district, cam_fee_per_month
held a ฿20,199,600 "monthly fee". Our station rent medians have never been
compared to anything.

bkkradar.com publishes a free, no-key, read-only API over Bangkok condo
listings pulled from Facebook groups — a source we do not scrape — including
median rent per station split by bedroom count. Different source, same city,
same unit: exactly what a cross-check needs.

What this script does NOT do
----------------------------
It does not store or publish their numbers. They are a competitor with no
terms page, their listings are their own curation, and our pages claim to
report what we measured. This reads one endpoint (169 stations in a single
request), prints a comparison, and leaves nothing behind in the database.

Two outputs:
  1. DIVERGENCE — stations where our 1-bedroom median is far from theirs.
     A big gap means one of us is wrong, and ours is the one we can fix.
  2. COVERAGE — stations where they have rent listings and we have few or
     none. That is a map for our own scrapers, not a shopping list.

    python scripts/crosscheck_station_rents.py
    python scripts/crosscheck_station_rents.py --min-listings 20 --json out.json
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import statistics
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

# Identify ourselves and link back; they allow /api/v1/* in robots.txt.
UA = "RealDataCrosscheck/1.0 (+https://passionaryestate.com)"
STATIONS_URL = "https://bkkradar.com/api/v1/stations"
# Their default page is 40 of 169, busiest first; 200 is the documented max.
STATIONS_LIMIT = 200

# web/lib/queries/stations.ts: a condo belongs to a station within 1 km.
RADIUS_M = 1000
# scripts/compute_yields.py --thb-per-usd default. hipflat prices in USD.
THB_PER_USD = 34.0


def slug(name: str) -> str:
    """Station name -> comparable key. Mirrors web/lib/stations.ts closely
    enough for matching: ASCII, lowercase, hyphens, no BTS/MRT prefix."""
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    s = s.lower().strip()
    s = re.sub(r"^(bts|mrt|arl)[\s-]+", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def fetch_all(client, table: str, columns: str, order_by: str = "id", **filters):
    out: list[dict] = []
    offset = 0
    while True:
        q = client.table(table).select(columns)
        for k, v in filters.items():
            q = q.eq(k, v)
        page = q.order(order_by).range(offset, offset + 999).execute().data or []
        out.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    return out


def our_station_rents() -> dict[str, dict]:
    """Median monthly rent per station, from active 1-bedroom rent listings
    on condos within 1 km of that station."""
    client = get_client()

    liv = fetch_all(
        client,
        "livability_metrics",
        "condo_id, nearest_bts_station, nearest_bts_distance_m, "
        "nearest_mrt_station, nearest_mrt_distance_m",
        order_by="condo_id",  # this table is keyed on condo_id, not id
    )
    condo_stations: dict[str, set[str]] = {}
    for r in liv:
        for name_key, dist_key in (
            ("nearest_bts_station", "nearest_bts_distance_m"),
            ("nearest_mrt_station", "nearest_mrt_distance_m"),
        ):
            name, dist = r.get(name_key), r.get(dist_key)
            if not name or dist is None or dist > RADIUS_M:
                continue
            condo_stations.setdefault(r["condo_id"], set()).add(slug(name))

    rents = fetch_all(
        client,
        "listings",
        "condo_id, price, currency, bedrooms",
        listing_type="rent",
        is_active=True,
    )

    by_station: dict[str, list[float]] = {}
    counts: dict[str, int] = {}
    for r in rents:
        stations = condo_stations.get(r["condo_id"])
        if not stations:
            continue
        price = r.get("price")
        if price is None:
            continue
        thb = float(price) * (THB_PER_USD if (r.get("currency") or "THB") == "USD" else 1.0)
        for st in stations:
            counts[st] = counts.get(st, 0) + 1
            if r.get("bedrooms") == 1:
                by_station.setdefault(st, []).append(thb)

    return {
        st: {
            "rent_listings": counts.get(st, 0),
            "median_1br": round(statistics.median(v)) if v else None,
            "samples_1br": len(v),
        }
        for st, v in {**{k: [] for k in counts}, **by_station}.items()
    }


def their_station_rents() -> dict[str, dict]:
    r = requests.get(
        STATIONS_URL,
        params={"limit": STATIONS_LIMIT},
        headers={"User-Agent": UA},
        timeout=60,
    )
    r.raise_for_status()
    payload = r.json()
    if not payload.get("ok"):
        raise RuntimeError(f"bkkradar returned {payload}")
    out: dict[str, dict] = {}
    for s in payload["data"]["stations"]:
        entry = {
            "name": s["name"],
            "rent_listings": s.get("rent_listings") or 0,
            "median_1br": (s.get("median_rent") or {}).get("one"),
        }
        # They merge interchanges into one row ("Asok / Sukhumvit"); our
        # livability layer names each station separately, so index both halves
        # against the same figures.
        for part in s["name"].split("/"):
            key = slug(part)
            if key:
                out[key] = entry
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-samples", type=int, default=5,
                    help="our 1BR listings needed before a median is compared")
    ap.add_argument("--min-listings", type=int, default=50,
                    help="their rent listings needed before a station counts as a gap")
    ap.add_argument("--json", help="also write the full comparison here")
    args = ap.parse_args()

    ours = our_station_rents()
    theirs = their_station_rents()
    logger.info(f"ours: {len(ours)} stations | theirs: {len(theirs)} stations")
    matched = sorted(set(ours) & set(theirs))
    logger.info(f"matched by name: {len(matched)}")

    rows = []
    for st in matched:
        o, t = ours[st], theirs[st]
        if o["samples_1br"] < args.min_samples or not t["median_1br"] or not o["median_1br"]:
            continue
        ratio = o["median_1br"] / t["median_1br"]
        rows.append((abs(ratio - 1), ratio, st, t["name"], o, t))
    rows.sort(reverse=True)

    print("\n=== DIVERGENCE: our 1BR median vs theirs (worst first) ===")
    print(f"{'station':22} {'ours':>9} {'theirs':>9} {'ratio':>6}  {'our n':>6} {'their n':>7}")
    for _, ratio, _st, name, o, t in rows[:20]:
        print(
            f"{name[:22]:22} {o['median_1br']:>9,} {t['median_1br']:>9,} "
            f"{ratio:>6.2f}  {o['samples_1br']:>6} {t['rent_listings']:>7}"
        )
    if rows:
        med = statistics.median([r[1] for r in rows])
        print(f"\nmedian ratio across {len(rows)} comparable stations: {med:.2f} "
              f"({'we read higher' if med > 1 else 'we read lower'})")

    gaps = [
        (t["rent_listings"], st, t["name"], ours.get(st, {}).get("rent_listings", 0))
        for st, t in theirs.items()
        if t["rent_listings"] >= args.min_listings
        and ours.get(st, {}).get("rent_listings", 0) < t["rent_listings"] / 5
    ]
    gaps.sort(reverse=True)
    print(f"\n=== COVERAGE: stations where our rent data is thin (<20% of theirs) ===")
    print(f"{'station':22} {'their rent':>11} {'our rent':>9}")
    for their_n, _st, name, our_n in gaps[:25]:
        print(f"{name[:22]:22} {their_n:>11,} {our_n:>9,}")
    print(f"\n{len(gaps)} stations to aim the rent scrapers at.")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(
                {"ours": ours, "theirs": theirs, "matched": matched},
                fh, ensure_ascii=False, indent=2,
            )
        logger.info(f"wrote {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
