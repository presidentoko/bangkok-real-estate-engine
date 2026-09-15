"""Decide which condo pages the Cloudflare export renders this run.

Condo pages are static HTML on Cloudflare Workers now (see
web/lib/buildMode.ts and .github/workflows/condo-static.yml). This script
writes the (lang, slug) sets the export build renders, split into shards so
one `next build` never has to hold ~46,000 pages at once, plus the list of
pages that must be removed because their condo is gone.

    python scripts/condo_static/plan.py --mode changed --manifest manifest.txt --out plan/
    python scripts/condo_static/plan.py --mode full --out plan/

--mode changed  condos whose last_seen_at moved inside --days, plus every
                published condo the store does not have yet (new slugs,
                or the first run with an empty manifest).
--mode full     every published condo. For layout/component changes, which
                touch every page.

The manifest is the store's current page list, one `lang/slug` per line.
A missing manifest file means an empty store.

Writes <out>/params-<i>.json (the CONDO_STATIC_PARAMS format),
<out>/removed.txt, and <out>/matrix.json (the shard indexes, for the
workflow's build matrix).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from src.db import fetch_all, get_client  # noqa: E402

LANGS = ("en", "ko", "th")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("changed", "full"), required=True)
    ap.add_argument("--days", type=int, default=8)
    ap.add_argument("--manifest", help="current store page list (lang/slug per line)")
    ap.add_argument("--shard-size", type=int, default=6000)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    condos = fetch_all(get_client(), "condos_published", "slug, last_seen_at")
    live = {c["slug"]: c.get("last_seen_at") for c in condos if c.get("slug")}

    stored: set[str] = set()
    if args.manifest and os.path.exists(args.manifest):
        with open(args.manifest, encoding="utf-8") as fh:
            stored = {line.strip() for line in fh if line.strip()}

    wanted = {f"{lang}/{slug}" for slug in live for lang in LANGS}
    removed = sorted(stored - wanted)
    # A condo leaves condos_published a handful at a time. Thousands at once
    # means the read came back short, and acting on it would delete live
    # pages from Cloudflare.
    if stored and len(removed) > 0.05 * len(stored):
        print(f"[plan] refusing: {len(removed)} of {len(stored)} stored pages would be removed")
        return 1

    if args.mode == "full":
        todo = sorted(wanted)
    else:
        cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.days)).isoformat()
        changed = {
            f"{lang}/{slug}"
            for slug, seen in live.items()
            if seen and seen >= cutoff
            for lang in LANGS
        }
        todo = sorted(changed | (wanted - stored))

    os.makedirs(args.out, exist_ok=True)
    shards = [todo[i : i + args.shard_size] for i in range(0, len(todo), args.shard_size)]
    for i, shard in enumerate(shards):
        params = [dict(zip(("lang", "slug"), p.split("/", 1))) for p in shard]
        with open(os.path.join(args.out, f"params-{i}.json"), "w", encoding="utf-8") as fh:
            json.dump(params, fh)
    with open(os.path.join(args.out, "removed.txt"), "w", encoding="utf-8") as fh:
        fh.write("".join(f"{p}\n" for p in removed))
    with open(os.path.join(args.out, "matrix.json"), "w", encoding="utf-8") as fh:
        json.dump(list(range(len(shards))), fh)

    print(f"[plan] mode={args.mode} live condos={len(live)} stored pages={len(stored)}")
    print(f"[plan] render {len(todo)} pages in {len(shards)} shard(s); remove {len(removed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
