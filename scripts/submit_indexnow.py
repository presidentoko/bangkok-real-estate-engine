"""Submit changed URLs to IndexNow (Bing, Yandex, Seznam, Naver).

Why this exists
---------------
Google gets a sitemap and crawls on its own schedule; there is no supported
way to push it a URL any more (the sitemap ping endpoint was retired in
2023). Every *other* engine that matters here does accept a push, through
one shared protocol: IndexNow. Bing is what answers Copilot and a slice of
DuckDuckGo, and Naver is where this site's Korean audience actually
searches — there is already a Naver site-verification file in web/public.

Cost: zero. No account, no quota, no key exchange beyond a static file
served from our own domain.

How the key works
-----------------
The engine fetches https://<host>/<key>.txt and expects the file body to be
exactly <key>. That proves whoever submitted the URLs controls the host.
The file lives at web/public/28c567adce2db7e795b2d6acf80c4fde.txt and is
deployed with the site — if that file ever stops resolving, submissions are
rejected and this script will say so rather than failing silently.

What gets submitted
-------------------
Changed URLs only, which is what the protocol is for:

  * every condo whose last_seen_at moved in the last SINCE_DAYS days AND
    which passes the same substance gate the sitemap uses
    (web/lib/condoIndexability.ts) — no point pushing a page we are telling
    Google not to index,
  * the hub pages, whose numbers change every refresh,
  * district pages with >= 3 published condos.

x3 locales, deduped, batched at IndexNow's 10,000-URL-per-request cap.

Usage
-----
    python scripts/submit_indexnow.py            # dry run, prints counts
    python scripts/submit_indexnow.py --submit   # actually POSTs
    python scripts/submit_indexnow.py --submit --since-days 30
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.db import get_client, fetch_all  # noqa: E402

HOST = "passionaryestate.com"
SITE = f"https://{HOST}"
KEY = "28c567adce2db7e795b2d6acf80c4fde"
KEY_LOCATION = f"{SITE}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/indexnow"

LANGS = ("en", "ko", "th")
BATCH = 10_000
SINCE_DAYS = 8  # weekly cadence + a day of slack

# Mirrors web/app/sitemap-static.xml/route.ts's STATIC_PATHS. Kept short on
# purpose: these are the pages whose numbers actually move every refresh.
HUB_PATHS = (
    "",
    "/districts",
    "/inventory",
    "/yields",
    "/flood",
    "/macro",
    "/data",
    "/stale",
    "/reality",
    "/blog",
    "/retiree",
    "/guide/investment",
    "/guide/foreign-ownership",
)

# Mirrors hasIndexableSubstance() in web/lib/condoIndexability.ts. If that
# predicate changes, change this one with it — submitting a URL we serve
# with <meta name="robots" content="noindex"> is a wasted push at best.
MIN_DESCRIPTION_CHARS = 120


def has_substance(row: dict) -> bool:
    if (row.get("active_listings_count") or 0) >= 1:
        return True
    if row.get("market_sale_median") is not None:
        return True
    if row.get("market_rent_median") is not None:
        return True
    if row.get("gross_yield_pct") is not None:
        return True
    if len((row.get("description") or "").strip()) >= MIN_DESCRIPTION_CHARS:
        return True
    if (row.get("google_review_count") or 0) >= 3:
        return True
    return False


def verify_key_file() -> bool:
    """The key file has to be live before a submission is worth making."""
    try:
        with urllib.request.urlopen(KEY_LOCATION, timeout=15) as r:
            body = r.read().decode("utf-8", "replace").strip()
    except urllib.error.HTTPError as e:
        print(f"[indexnow] key file {KEY_LOCATION} -> HTTP {e.code}")
        return False
    except Exception as e:  # noqa: BLE001 - network shape varies
        print(f"[indexnow] key file {KEY_LOCATION} unreachable: {e}")
        return False
    if body != KEY:
        print(f"[indexnow] key file body mismatch: {body[:40]!r} != {KEY!r}")
        return False
    return True


def collect_paths(since_days: int) -> list[str]:
    client = get_client()
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=since_days)).isoformat()

    paths: list[str] = list(HUB_PATHS)

    condos = fetch_all(
        client,
        "condos_published",
        "slug, last_seen_at, active_listings_count, market_sale_median, "
        "market_rent_median, gross_yield_pct, description, google_review_count",
    )
    changed = 0
    for c in condos:
        slug = c.get("slug")
        seen = c.get("last_seen_at")
        if not slug or not seen or seen < cutoff:
            continue
        if not has_substance(c):
            continue
        paths.append(f"/condo/{slug}")
        changed += 1
    print(f"[indexnow] condos changed in {since_days}d and above the bar: {changed}")

    # Districts: same >=3-condo bar as sitemap-areas.xml.
    regions = client.table("regions").select("name, condos(id)").limit(500).execute().data or []
    districts = 0
    for r in regions:
        if not r.get("name") or len(r.get("condos") or []) < 3:
            continue
        paths.append(f"/district/{r['name'].lower()}")
        districts += 1
    print(f"[indexnow] district pages: {districts}")

    return paths


def post_batch(urls: list[str]) -> bool:
    payload = json.dumps(
        {
            "host": HOST,
            "key": KEY,
            "keyLocation": KEY_LOCATION,
            "urlList": urls,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            # 200 accepted, 202 accepted-pending-key-validation. Both fine.
            print(f"[indexnow] POST {len(urls)} urls -> HTTP {r.status}")
            return r.status in (200, 202)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        print(f"[indexnow] POST {len(urls)} urls -> HTTP {e.code}: {body}")
        return False
    except Exception as e:  # noqa: BLE001
        print(f"[indexnow] POST failed: {e}")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--submit", action="store_true", help="actually POST (default: dry run)")
    ap.add_argument("--since-days", type=int, default=SINCE_DAYS)
    args = ap.parse_args()

    paths = collect_paths(args.since_days)
    urls = sorted({f"{SITE}/{lang}{p}" for p in paths for lang in LANGS})
    print(f"[indexnow] {len(urls)} URLs across {len(LANGS)} locales")

    if not args.submit:
        for u in urls[:10]:
            print("  ", u)
        if len(urls) > 10:
            print(f"   ... and {len(urls) - 10} more")
        print("[indexnow] dry run — pass --submit to POST")
        return 0

    if not verify_key_file():
        print("[indexnow] refusing to submit without a live key file")
        return 1

    ok = True
    for i in range(0, len(urls), BATCH):
        ok = post_batch(urls[i : i + BATCH]) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
