# -*- coding: utf-8 -*-
"""Regenerate web/public/u/<2hex>.json -- the legacy /condo/<uuid> -> slug map.

Why this exists. Before slugs, every condo URL was /condo/<uuid>, and Google
still holds thousands of them: in the 2026-09-07 Search Console export 596
of the top 1,000 pages by impressions were uuid URLs, carrying more than
half of all impressions. The page route resolves a uuid with a Supabase
lookup and calls permanentRedirect(), but that route is ISR, and an ISR page
cannot emit a real 308 -- it degrades to a 200 whose RSC payload carries a
NEXT_REDIRECT digest that only a JS client follows. Google files that as a
soft redirect at best and, as the export shows, keeps ranking the uuid URL
itself. Each such crawl is also a cold serverless render against a Fluid
Active CPU allowance that hit 100% this cycle.

The middleware (web/middleware.ts) now answers those URLs with a real 308
without touching the database: it fetches the shard for the uuid's first two
hex characters from this directory via raw.githubusercontent.com (the repo
is public) and looks the uuid up. 256 shards of ~60 entries, ~4.5KB each,
instead of a 1MB map in an edge bundle with a 1MB limit.

Run after scripts/backfill_condo_slug.py (weekly-refresh.yml does) and
commit the result; the middleware reads the `main` branch, so a shard is
live the moment it is pushed, no deploy required.

    python scripts/gen_uuid_map.py            # writes web/public/u/
    python scripts/gen_uuid_map.py --check    # exit 1 if the tree is stale
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "web" / "public" / "u"
PAGE = 1000  # PostgREST hard-caps a single response at 1000 rows


def _env(name: str, *alts: str) -> str:
    for key in (name, *alts):
        v = os.environ.get(key)
        if v:
            return v
    # Fall back to the two local env files so this runs from a bare shell.
    for envfile in (ROOT / ".env", ROOT / "web" / ".env.local"):
        if not envfile.exists():
            continue
        for line in envfile.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() in (name, *alts) and v.strip():
                return v.strip().strip('"').strip("'")
    sys.exit(f"missing env: {name}")


def fetch_pairs() -> dict[str, str]:
    base = _env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    key = _env("SUPABASE_SERVICE_KEY")
    pairs: dict[str, str] = {}
    offset = 0
    while True:
        q = urllib.parse.urlencode(
            {"select": "id,slug", "slug": "not.is.null", "order": "id",
             "offset": offset, "limit": PAGE}
        )
        req = urllib.request.Request(
            f"{base}/rest/v1/condos?{q}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            rows = json.load(r)
        for row in rows:
            uid = str(row["id"]).lower()
            slug = str(row["slug"]).strip()
            if len(uid) == 36 and slug:
                pairs[uid] = slug
        if len(rows) < PAGE:
            break
        offset += PAGE
    return pairs


def shard(pairs: dict[str, str]) -> dict[str, dict[str, str]]:
    shards: dict[str, dict[str, str]] = {f"{i:02x}": {} for i in range(256)}
    for uid, slug in pairs.items():
        shards[uid[:2]][uid] = slug
    return shards


def render(entries: dict[str, str]) -> str:
    # Sorted keys and no whitespace: byte-identical output for identical data,
    # so a weekly regeneration with nothing new produces no diff.
    return json.dumps(dict(sorted(entries.items())), separators=(",", ":"), ensure_ascii=True)


def main() -> int:
    check = "--check" in sys.argv
    pairs = fetch_pairs()
    shards = shard(pairs)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    changed = 0
    for name, entries in shards.items():
        path = OUT_DIR / f"{name}.json"
        body = render(entries)
        old = path.read_text(encoding="utf-8") if path.exists() else None
        if old == body:
            continue
        changed += 1
        if not check:
            path.write_text(body, encoding="utf-8", newline="\n")
    total = sum(len(v) for v in shards.values())
    biggest = max(len(render(v)) for v in shards.values())
    print(f"uuid-map: {total} condos, 256 shards, largest {biggest} bytes, "
          f"{changed} shard(s) {'stale' if check else 'written'}")
    return 1 if (check and changed) else 0


if __name__ == "__main__":
    sys.exit(main())
