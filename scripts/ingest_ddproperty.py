"""DDProperty Bangkok condo ingest via nodriver (CF-resistant).

Uses nodriver (undetected Chrome) with a persistent profile so Cloudflare
clearance cookies survive between runs. Slow page cadence (default 45s) to
stay under the radar.

First run: a browser window opens. nodriver's verify_cf() tries to auto-click
the Turnstile checkbox. If CF is still showing after a few seconds, click the
checkbox manually — you have up to 3 minutes.

Usage:
  python scripts/ingest_ddproperty.py
  python scripts/ingest_ddproperty.py --listing-type rent
  python scripts/ingest_ddproperty.py --limit 200 --delay-s 30
"""
from __future__ import annotations

import argparse
import asyncio
import io
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc
from bs4 import BeautifulSoup
from loguru import logger

from src.db import (
    _normalize_project_name,
    _normalize_project_name_aggressive,
    build_hipflat_name_index,
    get_client,
    upsert_ddproperty_condo,
    upsert_ddproperty_listing,
)
from src.scrapers.hipflat import _unwrap

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile-ddproperty")
BASE_URL = "https://www.ddproperty.com"

# city_slug → DDProperty path segment (from site nav links)
CITY_SLUGS = {
    "bangkok":    "bangkok-th10",
    "phuket":     "phuket-th83",
    "chiang-mai": "chiang-mai-th50",
    "pattaya":    "pattaya-th20",
    "hua-hin":    "hua-hin-th7707",
}

SEARCH_PATH_TMPL = {
    "sale": "/en/condo-for-sale/in-{slug}",
    "rent": "/en/condo-for-rent/in-{slug}",
}

GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 180  # user may need to click manually
EVALUATE_TIMEOUT_S = 20

# Price regexes (same as original ddproperty.py)
PRICE_RE = re.compile(
    r"(?:฿|THB)\s*([\d,]+(?:\.\d+)?)\s*(M|K|MILLION)?", flags=re.IGNORECASE
)
AREA_RE = re.compile(r"([\d.]+)\s*(?:sq\.?\s*m|m²|sqm)", flags=re.IGNORECASE)
SID_RE = re.compile(r"-(\d{6,})(?:[?#]|$)")


def _parse_price(text: str) -> float | None:
    for m in PRICE_RE.finditer(text):
        try:
            val = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        unit = (m.group(2) or "").upper()
        if unit in ("M", "MILLION"):
            val *= 1_000_000
        elif unit == "K":
            val *= 1_000
        if val >= 100_000:
            return val
    return None


def _parse_area(text: str) -> float | None:
    m = AREA_RE.search(text or "")
    return float(m.group(1)) if m else None


def _extract_name(title_attr: str | None) -> str | None:
    if not title_attr:
        return None
    s = title_attr.strip()
    s = re.sub(r"^(For Sale|For Rent)\s*-\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r",\s*(Bangkok|Krung Thep|กรุงเทพ.*)$", "", s, flags=re.IGNORECASE)
    return s.strip() or None


def _parse_cards(html: str, listing_type: str) -> list[dict]:
    """Parse DDProperty search-result cards into our common dict shape.

    DDProperty redesigned the search page in early 2026 — the old
    `parent-listing-card-v2-regular` data-attribute container disappeared
    and was replaced with a class-based card `div.listing-card-v2`. The
    inner field markers (`da-id='listing-card-v2-bedrooms'` etc.) survived
    the redesign. Listing-id is no longer on the card itself — extract it
    from the trailing `-for-sale-<NUMERIC>` token in the property URL.
    """
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict] = []
    seen: set[str] = set()

    cards = soup.select("div.listing-card-v2")
    for card in cards:
        try:
            link = card.select_one("a[href*='/en/property/']")
            if not link:
                continue
            href = link.get("href", "")
            url = href if href.startswith("http") else BASE_URL + href
            m = SID_RE.search(url)
            sid = m.group(1) if m else None
            if not sid or sid in seen:
                continue

            # Title — title da-id may have a suffix; use wildcard match.
            title_el = card.select_one("[da-id*='listing-card-v2-title']")
            if not title_el:
                continue
            raw_title = title_el.get_text(strip=True)
            name = re.sub(
                r",\s*(Bangkok|Chiang Mai|Phuket|Pattaya|\w[\w ]+)$",
                "",
                raw_title,
                flags=re.IGNORECASE,
            ).strip() or None

            # Price — the v2 price element wraps multiple spans
            # ('฿11,450,000' + '฿107,988/sqm' tooltip). Take the headline
            # which lives in the first numeric token.
            price_el = card.select_one("[da-id*='listing-card-v2-price']")
            price_text = price_el.get_text(" ", strip=True) if price_el else ""
            price = _parse_price(price_text) if price_text else None

            def _int_el(da_id: str) -> int | None:
                el = card.select_one(f"[da-id='{da_id}']")
                if not el:
                    return None
                # Be tolerant of '2+1' bedroom layouts (treat as 2)
                txt = el.get_text(strip=True)
                m = re.match(r"\d+", txt)
                return int(m.group(0)) if m else None

            beds = _int_el("listing-card-v2-bedrooms")
            baths = _int_el("listing-card-v2-bathrooms")

            area_el = card.select_one("[da-id='listing-card-v2-area']")
            area = _parse_area(area_el.get_text(strip=True) if area_el else "")

            # New in the redesign: per-card ownership tenure (Freehold /
            # Leasehold). Surface it so foreign-quota analysis improves.
            tenure_el = card.select_one("[da-id='listing-card-v2-tenure']")
            tenure = tenure_el.get_text(strip=True) if tenure_el else None

            year_el = card.select_one("[da-id='listing-card-v2-build-year']")
            year_built = None
            if year_el:
                ytxt = year_el.get_text(strip=True)
                m = re.search(r"(\d{4})", ytxt)
                if m:
                    year_built = int(m.group(1))

            if not (name and price):
                continue
            seen.add(sid)
            out.append({
                "source": "ddproperty",
                "source_listing_id": sid,
                "name": name,
                "url": url,
                "listing_type": listing_type,
                "price": price,
                "area_sqm": area,
                "bedrooms": beds,
                "bathrooms": baths,
                "ownership": tenure,
                "year_built": year_built,
            })
        except Exception as e:
            logger.debug(f"[ddproperty] card parse error: {e}")

    return out


def _page_url(base_path: str, page_num: int) -> str:
    if page_num <= 1:
        return BASE_URL + base_path
    return f"{BASE_URL}{base_path}/{page_num}"


async def _fetch_page_html(browser, url: str) -> str | None:
    try:
        tab = await asyncio.wait_for(browser.get(url), timeout=GOTO_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning(f"[ddproperty] goto timed out: {url}")
        return None
    except Exception as e:
        logger.warning(f"[ddproperty] goto failed: {e}")
        return None
    try:
        await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.error("[ddproperty] CF challenge not cleared in time — stopping")
        return None
    except Exception as e:
        logger.debug(f"[ddproperty] verify_cf: {e}")
    await asyncio.sleep(3.0)
    try:
        html = _unwrap(
            await asyncio.wait_for(
                tab.evaluate("document.documentElement.outerHTML"),
                timeout=EVALUATE_TIMEOUT_S,
            )
        )
        return html
    except Exception as e:
        logger.warning(f"[ddproperty] outerHTML failed: {e}")
        return None


async def _save_debug_html(browser, url: str, path: str) -> None:
    """Fetch a page and save the rendered HTML for selector debugging."""
    html = await _fetch_page_html(browser, url)
    if html:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"Saved {len(html):,} chars to {path}")


async def run(listing_type: str, delay_s: float, max_listings: int | None, city: str = "bangkok") -> None:
    slug = CITY_SLUGS[city]
    base_path = SEARCH_PATH_TMPL[listing_type].format(slug=slug)
    logger.info(f"[ddproperty] city={city}  type={listing_type}  path={base_path}")
    os.makedirs(PROFILE_DIR, exist_ok=True)

    client = get_client()
    logger.info("Building hipflat name index for cross-source matching...")
    name_idx = build_hipflat_name_index(client)
    logger.info(f"  {len(name_idx)} hipflat condos indexed")

    dp_condo_cache: dict[str, str] = {}
    stats = Counter()
    started = time.time()

    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_DIR,
        sandbox=True,
    )

    try:
        page_num = 1
        empty_pages = 0
        while True:
            if max_listings and stats["seen"] >= max_listings:
                break
            url = _page_url(base_path, page_num)
            logger.info(f"[ddproperty] page {page_num}: {url}")

            html = await _fetch_page_html(browser, url)
            if html is None:
                break

            cards = _parse_cards(html, listing_type)
            logger.info(f"[ddproperty] page {page_num}: {len(cards)} cards parsed")

            if not cards:
                empty_pages += 1
                if empty_pages >= 2:
                    logger.info("[ddproperty] 2 empty pages — done")
                    break
            else:
                empty_pages = 0

            for item in cards:
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
                elif key in dp_condo_cache:
                    condo_id = dp_condo_cache[key]
                    stats["existing_dd"] += 1
                else:
                    try:
                        condo_id = upsert_ddproperty_condo(client, name, item)
                    except Exception as e:
                        logger.warning(f"upsert_ddproperty_condo failed {name!r}: {e}")
                        stats["condo_fail"] += 1
                        continue
                    dp_condo_cache[key] = condo_id
                    stats["new_dd"] += 1

                try:
                    upsert_ddproperty_listing(client, condo_id, item)
                    stats["listings_upserted"] += 1
                except Exception as e:
                    logger.warning(f"upsert_ddproperty_listing failed: {e}")
                    stats["listing_fail"] += 1

            elapsed = time.time() - started
            logger.info(
                f"progress  seen={stats['seen']}  matched_hipflat={stats['matched_hipflat']}  "
                f"new_dd={stats['new_dd']}  upserted={stats['listings_upserted']}  "
                f"elapsed={elapsed/60:.1f}min"
            )

            page_num += 1
            logger.info(f"[ddproperty] sleeping {delay_s}s before next page...")
            await asyncio.sleep(delay_s)

    finally:
        browser.stop()

    elapsed = time.time() - started
    logger.info(f"DONE in {elapsed/60:.1f} min — {dict(stats)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--listing-type", choices=["sale", "rent"], default="sale")
    ap.add_argument("--city", choices=list(CITY_SLUGS.keys()), default="bangkok")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--delay-s", type=float, default=45.0,
                    help="Seconds between pages (default: 45)")
    args = ap.parse_args()
    asyncio.run(run(args.listing_type, args.delay_s, args.limit, args.city))


if __name__ == "__main__":
    main()
