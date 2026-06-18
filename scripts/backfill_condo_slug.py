"""
Backfill `condos.slug` for all rows that have none.

Formula: {slugify(name)}-{slugify(province)}
Collision fallback 1: append -{slugify(region)}
Collision fallback 2: append -2, -3, ...

Thai-only names (no ASCII after slugify) get a -{id[:8]} suffix
so they're always unique and human-readable.

Run after applying db/014_condo_slug.sql.
"""

import os
import re
import sys
import unicodedata
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client
from loguru import logger

load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_SERVICE_KEY"]


def slugify(text: str) -> str:
    """Lower-case, ASCII-only, hyphen-separated slug."""
    if not text:
        return ""
    # Normalise unicode → decompose accents
    text = unicodedata.normalize("NFKD", text)
    # Keep only ASCII
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    # Replace anything non-alphanumeric with a hyphen
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = text.strip("-")
    return text


def make_slug(name: str, province: str, region: Optional[str], uid: str) -> str:
    base = slugify(name)
    prov = slugify(province) if province else "thailand"

    if not base:
        # Fully Thai name — use uid prefix as the anchor
        base = f"condo-{uid[:8]}"

    candidate = f"{base}-{prov}" if prov and prov != base else base
    return candidate


def run() -> None:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all condos without a slug (resumable)
    logger.info("Fetching condos without slug...")
    PAGE = 1000
    offset = 0
    all_rows = []
    while True:
        res = (
            sb.table("condos")
            .select("id, name, province, regions(name)")
            .is_("slug", "null")
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        batch = res.data or []
        all_rows.extend(batch)
        if len(batch) < PAGE:
            break
        offset += PAGE

    logger.info(f"Found {len(all_rows)} condos without slug")
    if not all_rows:
        logger.info("Nothing to do.")
        return

    # Track used slugs (existing + generated this run) to detect collisions.
    # Paginate so we don't miss rows beyond the default 1000-row limit.
    used: set[str] = set()
    slug_offset = 0
    while True:
        existing_res = (
            sb.table("condos")
            .select("slug")
            .not_.is_("slug", "null")
            .range(slug_offset, slug_offset + PAGE - 1)
            .execute()
        )
        batch = existing_res.data or []
        for r in batch:
            if r.get("slug"):
                used.add(r["slug"])
        if len(batch) < PAGE:
            break
        slug_offset += PAGE
    logger.info(f"Loaded {len(used)} existing slugs")

    updated = 0
    skipped = 0

    for row in all_rows:
        uid: str = row["id"]
        name: str = row.get("name") or ""
        province: str = row.get("province") or "thailand"
        regions = row.get("regions")
        if isinstance(regions, list):
            region_name = regions[0].get("name") if regions else None
        elif isinstance(regions, dict):
            region_name = regions.get("name")
        else:
            region_name = None

        candidate = make_slug(name, province, region_name, uid)

        if not candidate:
            logger.warning(f"[{uid}] Could not generate slug for name={name!r}, skipping")
            skipped += 1
            continue

        # Resolve collisions
        if candidate not in used:
            final = candidate
        else:
            # Try with region
            if region_name:
                extended = f"{candidate}-{slugify(region_name)}"
                if extended not in used:
                    final = extended
                else:
                    # Numeric suffix
                    n = 2
                    while True:
                        attempt = f"{extended}-{n}"
                        if attempt not in used:
                            final = attempt
                            break
                        n += 1
            else:
                n = 2
                while True:
                    attempt = f"{candidate}-{n}"
                    if attempt not in used:
                        final = attempt
                        break
                    n += 1

        used.add(final)

        # Retry up to 3 times for network errors; DB constraint errors are not retried.
        for attempt in range(3):
            try:
                res = sb.table("condos").update({"slug": final}).eq("id", uid).execute()
                if res.data:
                    updated += 1
                else:
                    logger.warning(f"[{uid}] Update returned no data: {res}")
                    skipped += 1
                break
            except Exception as exc:
                err_str = str(exc)
                if "23505" in err_str or "duplicate key" in err_str.lower():
                    # DB unique constraint: add numeric suffix and retry immediately
                    used.add(final)
                    n = 2
                    while True:
                        attempt2 = f"{final}-{n}"
                        if attempt2 not in used:
                            final = attempt2
                            break
                        n += 1
                    used.add(final)
                    # retry the loop with new final value
                    continue
                if attempt < 2:
                    import time
                    logger.warning(f"[{uid}] Network error ({exc}), reconnecting...")
                    time.sleep(2 ** attempt)
                    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
                else:
                    logger.error(f"[{uid}] Failed after 3 attempts: {exc}")
                    skipped += 1

        if updated % 500 == 0 and updated > 0:
            logger.info(f"  {updated}/{len(all_rows)} updated...")

    logger.info(f"Done. updated={updated} skipped={skipped}")


if __name__ == "__main__":
    run()
