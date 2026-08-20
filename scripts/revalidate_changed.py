"""Rebuild only the pages whose data actually moved this week.

condo/[slug] used to carry `revalidate = 604800`. That constant applied to
the whole catalogue — 15,485 published condos x 3 locales, ~46,000 URLs, of
which the page prebuilds 900 and the rest are on-demand ISR. Every entry
Google had ever crawled therefore rewrote itself every seven days, whether
or not anything about the building had changed, and roughly 9,750 of those
buildings are noindex stubs that will never change at all. The 2026-08-20
Vercel reading was 549K ISR writes against a 200K allowance and 9.79GB of a
10GB Fast Origin Transfer cap; 549K x ~18KB is 9.9GB, which is that number
arrived at from the other direction.

So the page's own revalidate is 30 days now, and this script supplies the
freshness instead: it POSTs the condos whose last_seen_at moved inside the
window to /api/revalidate, which calls revalidatePath() on each. A typical
week is ~750 condos = ~2,250 paths, against ~46,000 before.

    python scripts/revalidate_changed.py                 # dry run
    python scripts/revalidate_changed.py --submit
    python scripts/revalidate_changed.py --submit --days 14

Env: SITE_URL (default https://passionaryestate.com) and REVALIDATE_SECRET,
which must match the value set on the Vercel project.
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

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from src.db import fetch_all, get_client  # noqa: E402

LANGS = ("en", "ko", "th")
SITE_URL = os.environ.get("SITE_URL", "https://passionaryestate.com").rstrip("/")
# Cloudflare 403s Python-urllib/3.x outright, so every request from this repo
# needs an explicit User-Agent (same reason submit_indexnow.py sets one).
UA = "RealDataRevalidate/1.0 (+https://passionaryestate.com)"
# The endpoint caps at 6000; stay under it so a wide window fails loudly here
# rather than being silently truncated server-side.
MAX_PATHS = 6000


def has_substance(row: dict) -> bool:
    """Mirror of hasIndexableSubstance() in web/lib/condoIndexability.ts.

    Kept in sync by hand — change both together, same as submit_indexnow.py.
    """
    if (row.get("active_listings_count") or 0) >= 1:
        return True
    if row.get("market_sale_median") is not None:
        return True
    if row.get("market_rent_median") is not None:
        return True
    if row.get("gross_yield_pct") is not None:
        return True
    if len((row.get("description") or "").strip()) >= 120:
        return True
    if (row.get("google_review_count") or 0) >= 3:
        return True
    return False


def collect_paths(since_days: int) -> list[str]:
    client = get_client()
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=since_days)).isoformat()

    condos = fetch_all(
        client,
        "condos_published",
        "slug, last_seen_at, active_listings_count, market_sale_median, "
        "market_rent_median, gross_yield_pct, description, google_review_count",
    )
    paths: list[str] = []
    changed = 0
    for c in condos:
        slug = c.get("slug")
        seen = c.get("last_seen_at")
        if not slug or not seen or seen < cutoff:
            continue
        # A stub that changed still has nothing worth rebuilding for: it is
        # noindex either way, and rebuilding it is exactly the write this
        # whole change exists to stop paying for.
        if not has_substance(c):
            continue
        changed += 1
        paths.extend(f"/{lang}/condo/{slug}" for lang in LANGS)

    print(f"[revalidate] condos changed in {since_days}d and above the bar: {changed}")
    print(f"[revalidate] {len(paths)} paths")
    return paths


def post(paths: list[str], secret: str) -> bool:
    body = json.dumps({"paths": paths}).encode()
    req = urllib.request.Request(
        f"{SITE_URL}/api/revalidate",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-revalidate-secret": secret,
            "User-Agent": UA,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            payload = res.read().decode()
            print(f"[revalidate] HTTP {res.status} {payload[:200]}")
            return res.status == 200
    except urllib.error.HTTPError as exc:
        print(f"[revalidate] HTTP {exc.code} {exc.read()[:200]!r}")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"[revalidate] failed: {exc}")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--submit", action="store_true", help="POST (default: dry run)")
    ap.add_argument("--days", type=int, default=8)
    args = ap.parse_args()

    paths = collect_paths(args.days)
    if not paths:
        print("[revalidate] nothing changed — nothing to do")
        return 0
    if len(paths) > MAX_PATHS:
        print(
            f"[revalidate] {len(paths)} paths exceeds the endpoint's {MAX_PATHS} cap. "
            f"Narrow --days rather than letting the server truncate."
        )
        return 1

    if not args.submit:
        for p in paths[:10]:
            print("   ", p)
        if len(paths) > 10:
            print(f"    ... and {len(paths) - 10} more")
        print("[revalidate] dry run — pass --submit to POST")
        return 0

    secret = os.environ.get("REVALIDATE_SECRET")
    if not secret:
        print("[revalidate] REVALIDATE_SECRET not set")
        return 1
    return 0 if post(paths, secret) else 1


if __name__ == "__main__":
    sys.exit(main())
