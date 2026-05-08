"""ddproperty.com Bangkok condo scraper.

URL/selectors verified via scripts/discover_selectors.py + scripts/inspect_card.py.

Strategy:
  - Single Bangkok-wide search URL (no per-district URL exists on the site)
  - Card = div.listing-card-root with data-listing-id
  - Name from link title attribute ("For Sale - {Name}, Bangkok")
  - Price/area from card textContent regex (positions vary across card layouts)
  - District is normalised post-hoc by db.upsert_condo via util.district
"""
from __future__ import annotations

import re
from typing import AsyncIterator

from loguru import logger
from playwright.async_api import Page

from src.scrapers.base import (
    human_mouse,
    human_pause,
    human_scroll,
    new_stealth_page,
    stealth_context,
)

BASE_URL = "https://www.ddproperty.com"
SEARCH_PATH = "/en/condo-for-sale/in-bangkok-th10"
SEARCH_URL = f"{BASE_URL}{SEARCH_PATH}"

# Cards: try several selector variants. Many ddproperty cards expose a
# data-listing-id; some only carry the link with /listing/ or /property/.
CARD_SELECTORS = (
    "[data-listing-id]",
    "div.listing-card-root",
    "[da-id*='listing-card']",
)
LINK_SELECTOR = "a.listing-card-link, a[href*='/property/'], a[href*='/listing/']"

# Price like "฿4.5M", "4.5M THB", "฿4,500,000"
PRICE_RE = re.compile(
    r"(?:฿|THB)\s*([\d,]+(?:\.\d+)?)\s*(M|K|MILLION)?",
    flags=re.IGNORECASE,
)
# Area like "35 sqm", "35 m²", "35 sq.m"
AREA_RE = re.compile(r"([\d.]+)\s*(?:sq\.?\s*m|m²|sqm)", flags=re.IGNORECASE)


def _parse_price_thb(text: str) -> float | None:
    if not text:
        return None
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
        if val >= 100_000:  # plausible for a Bangkok condo (THB)
            return val
    return None


def _parse_area_sqm(text: str) -> float | None:
    m = AREA_RE.search(text or "")
    return float(m.group(1)) if m else None


def _extract_name(title_attr: str | None) -> str | None:
    """Title is like 'For Sale - The Privacy Parc Taopoon, Bangkok'."""
    if not title_attr:
        return None
    s = title_attr.strip()
    s = re.sub(r"^(For Sale|For Rent)\s*-\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r",\s*(Bangkok|Krung Thep|กรุงเทพ.*)$", "", s, flags=re.IGNORECASE)
    return s.strip() or None


def _id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"-(\d{6,})(?:[?#]|$)", url)
    return m.group(1) if m else None


async def _parse_cards(page: Page) -> list[dict]:
    # Combine candidate cards from all selectors, dedupe by listing id.
    raw_cards = []
    for sel in CARD_SELECTORS:
        try:
            raw_cards.extend(await page.query_selector_all(sel))
        except Exception:
            pass

    out: list[dict] = []
    seen: set[str] = set()
    for c in raw_cards:
        try:
            sid = await c.get_attribute("data-listing-id")
            link = await c.query_selector(LINK_SELECTOR)
            href = await link.get_attribute("href") if link else None
            url = href if (href and href.startswith("http")) else (
                BASE_URL + href if href else None
            )
            if not sid:
                sid = _id_from_url(url)
            if not sid or sid in seen:
                continue

            title_attr = await link.get_attribute("title") if link else None
            name = _extract_name(title_attr)

            text = await c.text_content() or ""
            price = _parse_price_thb(text)
            area = _parse_area_sqm(text)

            if not (name and price):
                continue
            seen.add(sid)
            out.append({
                "source": "ddproperty",
                "source_listing_id": sid,
                "name": name,
                "region": None,  # db.upsert_condo extracts district from name
                "url": url,
                "listing_type": "sale",
                "price": price,
                "area_sqm": area,
            })
        except Exception as e:
            logger.warning(f"[ddproperty] card parse failed: {e}")
    return out


def _page_url(n: int) -> str:
    """ddproperty paginates via /N suffix on the path."""
    if n <= 1:
        return SEARCH_URL
    return f"{SEARCH_URL}/{n}"


async def scrape(max_listings: int) -> AsyncIterator[dict]:
    yielded = 0
    async with stealth_context() as (_, ctx):
        page = await new_stealth_page(ctx)

        page_num = 1
        empty_pages = 0
        while yielded < max_listings:
            url = _page_url(page_num)
            logger.info(f"[ddproperty] GET page {page_num}: {url}")
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
            except Exception as e:
                logger.warning(f"[ddproperty] goto failed: {e}")
                break
            await human_pause()
            await human_mouse(page)
            await human_scroll(page)

            items = await _parse_cards(page)
            new_count = 0
            for item in items:
                if yielded >= max_listings:
                    break
                yield item
                yielded += 1
                new_count += 1
            logger.info(
                f"[ddproperty] page {page_num}: +{new_count} listings (total: {yielded})"
            )
            if new_count == 0:
                empty_pages += 1
                if empty_pages >= 2:
                    logger.info(
                        f"[ddproperty] 2 empty pages; stopping at {yielded}"
                    )
                    break
            else:
                empty_pages = 0
            page_num += 1
            if page_num > 20:  # hard ceiling
                break

        logger.info(f"[ddproperty] done ({yielded} listings)")
