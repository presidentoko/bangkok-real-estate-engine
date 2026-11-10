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
--mode indexable
                every published condo above the substance bar
                (scripts/condo_indexability.py) -- the ~3,600 buildings we
                actually ask Google to rank, about a quarter of `full`.
                This is the mode for a template change that only matters on
                a page someone can find: the 2026-10-25 title rewrite moved
                the price to the front of every <title>, and on the other
                11,853 buildings that title sits behind
                `robots: noindex, follow` where nobody reads it. The stubs
                keep whatever the store already holds and get refreshed by
                the next `full` run.

--mode ids      only the condos listed in --ids-file (one uuid per line, or a
                CSV with an `id` column -- e.g. a data/backups/ export of
                rows a repair changed). Reads just those rows' slugs, never
                the catalogue, and removes nothing. Requires the store's
                manifest, because a run against an empty store would publish
                a site of only these pages.

The manifest is the store's current page list, one `lang/slug` per line.
A missing manifest file means an empty store.

Writes <out>/params-<i>.json (the CONDO_STATIC_PARAMS format),
<out>/removed.txt, and <out>/matrix.json (the shard indexes, for the
workflow's build matrix).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from scripts.condo_indexability import SELECT as SUBSTANCE_SELECT  # noqa: E402
from scripts.condo_indexability import has_substance  # noqa: E402
from src.db import fetch_all, get_client  # noqa: E402

LANGS = ("en", "ko", "th")


def write_plan(out: str, shards: list[list[str]], removed: list[str], stored: int) -> None:
    os.makedirs(out, exist_ok=True)
    for i, shard in enumerate(shards):
        params = [dict(zip(("lang", "slug"), p.split("/", 1))) for p in shard]
        with open(os.path.join(out, f"params-{i}.json"), "w", encoding="utf-8") as fh:
            json.dump(params, fh)
    with open(os.path.join(out, "removed.txt"), "w", encoding="utf-8") as fh:
        fh.write("".join(f"{p}\n" for p in removed))
    with open(os.path.join(out, "matrix.json"), "w", encoding="utf-8") as fh:
        json.dump(list(range(len(shards))), fh)
    # How many pages the store held, so publish can refuse to deploy a store
    # that came back short: the Workers' asset set is replaced wholesale by
    # whatever dist/ holds, so a partial restore would unpublish the rest.
    with open(os.path.join(out, "stored.txt"), "w", encoding="utf-8") as fh:
        fh.write(f"{stored}\n")


def read_ids(path: str) -> list[str]:
    with open(path, encoding="utf-8", newline="") as fh:
        text = fh.read()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if lines and "id" in [c.strip() for c in lines[0].split(",")]:
        return [r["id"].strip() for r in csv.DictReader(text.splitlines()) if r.get("id")]
    return lines


def plan_ids(args) -> int:
    """Render only the listed condos. Reads those rows' slugs and nothing
    else -- no catalogue scan -- and removes no pages."""
    if not args.ids_file:
        print("[plan] --mode ids needs --ids-file")
        return 2
    stored: set[str] = set()
    if args.manifest and os.path.exists(args.manifest):
        with open(args.manifest, encoding="utf-8") as fh:
            stored = {line.strip() for line in fh if line.strip()}
    if not stored:
        print("[plan] refusing: --mode ids needs the store manifest (empty store)")
        return 1
    ids = sorted(set(read_ids(args.ids_file)))
    client = get_client()
    slugs: set[str] = set()
    for i in range(0, len(ids), 150):
        rows = (
            client.table("condos_published").select("slug")
            .in_("id", ids[i : i + 150]).execute().data
        ) or []
        slugs.update(r["slug"] for r in rows if r.get("slug"))
    todo = sorted(f"{lang}/{slug}" for slug in slugs for lang in LANGS)
    shards = [todo[i : i + args.shard_size] for i in range(0, len(todo), args.shard_size)]
    write_plan(args.out, shards, [], len(stored))
    print(f"[plan] mode=ids ids={len(ids)} published with slug={len(slugs)} stored pages={len(stored)}")
    print(f"[plan] render {len(todo)} pages in {len(shards)} shard(s); remove 0")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("changed", "full", "indexable", "ids"), required=True)
    ap.add_argument("--ids-file", help="--mode ids: uuids, one per line, or a CSV with an id column")
    ap.add_argument("--days", type=int, default=8)
    ap.add_argument("--manifest", help="current store page list (lang/slug per line)")
    ap.add_argument("--shard-size", type=int, default=6000)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if args.mode == "ids":
        return plan_ids(args)

    # `indexable` needs the substance columns; the other modes only need
    # the slug and the timestamp, and this table is ~15,500 rows wide.
    select = "slug, last_seen_at"
    if args.mode == "indexable":
        select = f"{select}, {SUBSTANCE_SELECT}"
    condos = fetch_all(get_client(), "condos_published", select)
    live = {c["slug"]: c.get("last_seen_at") for c in condos if c.get("slug")}
    substantive = {c["slug"] for c in condos if c.get("slug") and has_substance(c)}

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
    elif args.mode == "indexable":
        todo = sorted(f"{lang}/{slug}" for slug in substantive for lang in LANGS)
    else:
        cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=args.days)).isoformat()
        changed = {
            f"{lang}/{slug}"
            for slug, seen in live.items()
            if seen and seen >= cutoff
            for lang in LANGS
        }
        todo = sorted(changed | (wanted - stored))

    shards = [todo[i : i + args.shard_size] for i in range(0, len(todo), args.shard_size)]
    write_plan(args.out, shards, removed, len(stored))

    print(f"[plan] mode={args.mode} live condos={len(live)} stored pages={len(stored)}")
    if args.mode == "indexable":
        print(f"[plan] above the substance bar: {len(substantive)} of {len(live)} condos")
    print(f"[plan] render {len(todo)} pages in {len(shards)} shard(s); remove {len(removed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
