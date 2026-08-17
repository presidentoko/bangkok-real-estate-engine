"""Flip `published` on for every active condo in a province.

src/db.py deliberately never sets published=True from the ingest path — it
only ever sets False, and only for provinces outside LAUNCHED_PROVINCES.
The comment there is explicit that turning a province on is "a deliberate
one-off UPDATE, not something the ingest path should do behind your back".
This is that UPDATE, made repeatable and dry-run-by-default instead of
being pasted into the SQL editor and forgotten.

Order of operations when launching a province:

  1. add it to LAUNCHED_PROVINCES in src/db.py, or the next scrape of any
     building in it will set published=False again,
  2. run this with --apply.

Doing (2) without (1) works until the next Sunday refresh and then silently
reverts — which is the exact bug 3b1eca0 fixed for Phuket/Chiang Mai/
Pattaya.

    python scripts/publish_province.py nonthaburi                # dry run
    python scripts/publish_province.py nonthaburi --apply
    python scripts/publish_province.py nonthaburi --apply --unpublish
"""
from __future__ import annotations

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.db import LAUNCHED_PROVINCES, canonical_province, fetch_all, get_client  # noqa: E402

BATCH = 200


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("province", help="DB province slug, e.g. nonthaburi")
    ap.add_argument("--apply", action="store_true", help="write (default: dry run)")
    ap.add_argument(
        "--unpublish",
        action="store_true",
        help="set published=False instead — the undo for this script",
    )
    args = ap.parse_args()

    province = canonical_province(args.province)
    target = not args.unpublish

    if target and province not in LAUNCHED_PROVINCES:
        print(
            f"[publish] refusing: {province!r} is not in LAUNCHED_PROVINCES "
            f"(src/db.py). Add it first, or the next weekly refresh will "
            f"unpublish everything this run publishes."
        )
        return 1

    client = get_client()
    rows = [
        r
        for r in fetch_all(client, "condos", "id, slug, province, is_active, published")
        if r.get("province") == province and r.get("is_active")
    ]
    todo = [r for r in rows if bool(r.get("published")) is not target]

    print(f"[publish] province={province} active={len(rows)} to change={len(todo)}")
    with_slug = sum(1 for r in todo if r.get("slug"))
    print(f"[publish]   of those, {with_slug} have a slug (i.e. a reachable page)")

    if not args.apply:
        for r in todo[:10]:
            print("   ", r.get("slug") or r["id"])
        if len(todo) > 10:
            print(f"    ... and {len(todo) - 10} more")
        print("[publish] dry run — pass --apply to write")
        return 0

    changed = 0
    for i in range(0, len(todo), BATCH):
        ids = [r["id"] for r in todo[i : i + BATCH]]
        client.table("condos").update({"published": target}, returning="minimal").in_(
            "id", ids
        ).execute()
        changed += len(ids)
        print(f"[publish]   {changed}/{len(todo)}")

    print(f"[publish] done: published={target} on {changed} condos in {province}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
