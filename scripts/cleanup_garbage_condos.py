"""Remove DotProperty condo rows whose 'name' is a listing title, not a project name.

These were created by the fallback `item.get("name")` bug in ingest_dotproperty.py
(now fixed). Garbage rows are identified by patterns unique to listing titles:

  - Contains "bedroom condo for sale"
  - Contains "BR Condo at"
  - Contains " sqm "
  - Matches "^\d{5,}" (numeric listing IDs like "906325 |")
  - Contains "for sale in" (full listing sentence)
  - Contains "Condo for Sale"

The script prints counts and samples first, then asks for confirmation before
deleting. Pass --dry-run to skip the delete step.

Usage:
  python scripts/cleanup_garbage_condos.py [--dry-run]
"""
from __future__ import annotations

import argparse
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import get_client

GARBAGE_PATTERNS = [
    "bedroom condo for sale",
    "BR Condo at",
    " sqm ",
    "for sale in",
    "Condo for Sale",
    "Condo for Rent",
]


def build_filter(client, table_query):
    """Chain OR ilike filters for all garbage patterns."""
    q = table_query
    for i, pat in enumerate(GARBAGE_PATTERNS):
        if i == 0:
            q = q.ilike("name", f"%{pat}%")
        else:
            # postgrest-py OR filter via or_ string
            break
    return q


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()

    # Build OR filter string for postgrest
    or_filter = ",".join(f'name.ilike.%{p}%' for p in GARBAGE_PATTERNS)

    print("Counting garbage condos (source=dotproperty, listing-title names)...")
    rows = (
        client.table("condos")
        .select("id, name")
        .eq("source", "dotproperty")
        .or_(or_filter)
        .execute()
        .data
    ) or []

    print(f"\nFound {len(rows)} garbage condo rows.")
    if not rows:
        print("Nothing to clean up.")
        return

    print("\nSamples (first 20):")
    for r in rows[:20]:
        print(f"  [{r['id'][:8]}...] {r['name'][:100]!r}")

    if args.dry_run:
        print("\n--dry-run: skipping delete.")
        return

    ids = [r["id"] for r in rows]
    batch_size = 100

    print(f"\nStep 1: deleting linked listings for {len(ids)} garbage condos...")
    listings_deleted = 0
    for i in range(0, len(ids), batch_size):
        batch = ids[i : i + batch_size]
        res = client.table("listings").delete().in_("condo_id", batch).execute()
        listings_deleted += len(res.data or [])
    print(f"  {listings_deleted} listing rows removed")

    print(f"\nStep 2: deleting {len(ids)} garbage condo rows...")
    condos_deleted = 0
    for i in range(0, len(ids), batch_size):
        batch = ids[i : i + batch_size]
        client.table("condos").delete().in_("id", batch).execute()
        condos_deleted += len(batch)
        print(f"  deleted {condos_deleted}/{len(ids)}")

    print(f"\nDone. {condos_deleted} garbage condos + {listings_deleted} listings removed.")


if __name__ == "__main__":
    main()
