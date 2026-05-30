"""FazWaz Bangkok condo ingest via nodriver (CF-resistant).

Cloudflare is bypassed once the persistent profile under
`.nodriver-profile-fazwaz/` has cleared a Turnstile challenge. Subsequent
runs reuse cookies. First-time interactive setup: a browser opens; click
the Turnstile checkbox manually if asked.

Cross-source matching uses the same normalized-name index as DotProperty
/ DDProperty — FazWaz project names land on the same hipflat condo row
when they match (base or aggressive normalizer).

Usage:
  python scripts/ingest_fazwaz.py
  python scripts/ingest_fazwaz.py --listing-type rent
  python scripts/ingest_fazwaz.py --city bangkok --limit 300 --delay-s 12
"""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import sys
import time
from collections import Counter

import nodriver as uc
from bs4 import BeautifulSoup  # noqa: F401  (parser uses it; imported here for failure surfacing)
from loguru import logger

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import (  # noqa: E402
    _normalize_project_name,
    _normalize_project_name_aggressive,
    build_hipflat_name_index,
    get_client,
    upsert_fazwaz_condo,
    upsert_fazwaz_listing,
)
from src.scrapers.fazwaz import page_url, parse_cards  # noqa: E402
from src.scrapers.hipflat import _unwrap  # noqa: E402

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile-fazwaz")

CITY_PATHS = {
    "bangkok":    "/property-for-{lt}/thailand/bangkok",
    "phuket":     "/property-for-{lt}/thailand/phuket",
    "chiang-mai": "/property-for-{lt}/thailand/chiang-mai",
    "pattaya":    "/property-for-{lt}/thailand/chon-buri/pattaya",
    "hua-hin":    "/property-for-{lt}/thailand/prachuap-khiri-khan/hua-hin",
    # Secondary cities — FazWaz exposes these too, lower inventory.
    "chonburi":   "/property-for-{lt}/thailand/chon-buri",
    "krabi":      "/property-for-{lt}/thailand/krabi",
    "samui":      "/property-for-{lt}/thailand/surat-thani/koh-samui",
    "chiang-rai": "/property-for-{lt}/thailand/chiang-rai",
}
LISTING_TYPE_KEY = {"sale": "sale", "rent": "rent"}

GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 180
EVALUATE_TIMEOUT_S = 20


async def _fetch_page_html(browser, url: str) -> str | None:
    try:
        tab = await asyncio.wait_for(browser.get(url), timeout=GOTO_TIMEOUT_S)
    except Exception as e:
        logger.warning(f"[fazwaz] goto failed: {e}")
        return None
    try:
        await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.error("[fazwaz] CF challenge not cleared in time")
        return None
    except Exception as e:
        logger.debug(f"[fazwaz] verify_cf: {e}")
    await asyncio.sleep(4.0)
    try:
        return _unwrap(
            await asyncio.wait_for(
                tab.evaluate("document.documentElement.outerHTML"),
                timeout=EVALUATE_TIMEOUT_S,
            )
        )
    except Exception as e:
        logger.warning(f"[fazwaz] outerHTML failed: {e}")
        return None


async def run(listing_type: str, city: str, delay_s: float, max_listings: int | None) -> None:
    if city not in CITY_PATHS:
        raise ValueError(f"unknown city {city!r}")
    base_path = CITY_PATHS[city].format(lt=LISTING_TYPE_KEY[listing_type])

    os.makedirs(PROFILE_DIR, exist_ok=True)
    client = get_client()

    logger.info("Building hipflat name index (with aggressive variants)...")
    name_idx = build_hipflat_name_index(client)
    logger.info(f"  {len(name_idx)} keys")

    fz_condo_cache: dict[str, str] = {}
    stats = Counter()
    started = time.time()

    # Bail-out logic
    #   empty_pages  — N consecutive pages with 0 cards parsed
    #   stale_pages  — N consecutive pages where every card was already seen
    #                  this run (Fazwaz's pagination loops past the real end
    #                  with duplicate cards, so the empty-page check alone
    #                  doesn't catch it — we'd grind for hours otherwise).
    EMPTY_BAIL = 2
    STALE_BAIL = 5
    seen_sids: set[str] = set()
    browser = await uc.start(headless=False, user_data_dir=PROFILE_DIR, sandbox=True)
    try:
        page_num = 1
        empty_pages = 0
        stale_pages = 0
        while True:
            if max_listings and stats["seen"] >= max_listings:
                break
            url = page_url(base_path, page_num)
            logger.info(f"[fazwaz] page {page_num}: {url}")
            html = await _fetch_page_html(browser, url)
            if html is None:
                break

            items = parse_cards(html, listing_type=listing_type)
            logger.info(f"[fazwaz] page {page_num}: parsed {len(items)} cards")

            if not items:
                empty_pages += 1
                if empty_pages >= EMPTY_BAIL:
                    logger.info(f"[fazwaz] {EMPTY_BAIL} empty pages — done")
                    break
            else:
                empty_pages = 0

            # Did this page contribute any unseen source_listing_id? If not,
            # we're looping. Count consecutive stale pages and bail at the cap.
            page_sids = {it.get("source_listing_id") for it in items if it.get("source_listing_id")}
            new_sids = page_sids - seen_sids
            seen_sids |= page_sids
            if items and not new_sids:
                stale_pages += 1
                logger.info(
                    f"[fazwaz] page {page_num}: all {len(items)} cards already seen "
                    f"({stale_pages}/{STALE_BAIL} stale)"
                )
                if stale_pages >= STALE_BAIL:
                    logger.info(f"[fazwaz] {STALE_BAIL} stale pages — pagination looped, done")
                    break
            else:
                stale_pages = 0

            for item in items:
                if max_listings and stats["seen"] >= max_listings:
                    break
                stats["seen"] += 1
                name = item["name"]
                key = _normalize_project_name(name)
                akey = _normalize_project_name_aggressive(name)

                if key in name_idx:
                    condo_id = name_idx[key]
                    stats["matched_hipflat"] += 1
                elif akey and akey != key and akey in name_idx:
                    condo_id = name_idx[akey]
                    stats["matched_hipflat_aggressive"] += 1
                elif key in fz_condo_cache:
                    condo_id = fz_condo_cache[key]
                    stats["existing_fz"] += 1
                else:
                    try:
                        condo_id = upsert_fazwaz_condo(client, name, item)
                    except Exception as e:
                        logger.warning(f"upsert_fazwaz_condo failed {name!r}: {e}")
                        stats["condo_fail"] += 1
                        continue
                    fz_condo_cache[key] = condo_id
                    stats["new_fz"] += 1

                try:
                    upsert_fazwaz_listing(client, condo_id, item)
                    stats["listings_upserted"] += 1
                except Exception as e:
                    logger.warning(f"upsert_fazwaz_listing failed: {e}")
                    stats["listing_fail"] += 1

            elapsed = time.time() - started
            logger.info(
                f"progress  seen={stats['seen']}  matched_hipflat={stats['matched_hipflat']} "
                f"(+agg {stats['matched_hipflat_aggressive']})  new_fz={stats['new_fz']}  "
                f"upserted={stats['listings_upserted']}  elapsed={elapsed/60:.1f}min"
            )

            page_num += 1
            await asyncio.sleep(delay_s)
    finally:
        browser.stop()

    elapsed = time.time() - started
    logger.info(f"DONE in {elapsed/60:.1f} min — {dict(stats)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--listing-type", choices=["sale", "rent"], default="sale")
    ap.add_argument("--city", choices=list(CITY_PATHS.keys()), default="bangkok")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--delay-s", type=float, default=12.0,
                    help="Seconds between pages (default 12; FazWaz tolerates faster than DDProperty)")
    args = ap.parse_args()
    asyncio.run(run(args.listing_type, args.city, args.delay_s, args.limit))


if __name__ == "__main__":
    main()
