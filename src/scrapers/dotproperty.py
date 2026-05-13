"""dotproperty.co.th JSON-LD listing scraper.

DotProperty's search-result pages embed a Schema.org ItemList block with
up to 30 RealEstateListing entries per page — name, project, lat/lng,
price, address, datePosted — served as plain HTML with no Cloudflare
challenge (unlike hipflat/ddproperty/fazwaz). This makes simple httpx
sufficient; no browser, no stealth.

Yields one normalized dict per listing. Pagination via ?page=N until two
consecutive empty pages or max_pages reached.
"""
from __future__ import annotations

import json
import re
import time
from collections.abc import Iterator
from typing import Any

import httpx
from loguru import logger

BASE = "https://www.dotproperty.co.th"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Listing-type × city URL templates. Only the sale_condo / Bangkok combo is
# verified so far; add more after probing.
PATH_TEMPLATES = {
    "sale_condo": "/en/condos-for-sale/{city}",
}

_JSONLD_RE = re.compile(
    r'<script\s+type="application/ld\+json"[^>]*>([\s\S]*?)</script>',
    re.IGNORECASE,
)
# URL ends in `_<hex>-<hex>-...` (UUID-shaped, dashes preserved). Grab the
# whole tail after the last underscore — it's the stable listing ID.
_URL_ID_RE = re.compile(r"_([0-9a-f][0-9a-f-]{6,})(?:[?#]|$)")


def _parse_jsonld_itemlist(html: str) -> list[dict[str, Any]]:
    for raw in _JSONLD_RE.findall(html):
        try:
            d = json.loads(raw)
        except Exception:
            continue
        if isinstance(d, dict) and d.get("@type") == "ItemList":
            return d.get("itemListElement") or []
    return []


def _safe_float(v: Any) -> float | None:
    try:
        return float(v) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None


def _normalize(elem: dict[str, Any]) -> dict[str, Any] | None:
    item = elem.get("item") or {}
    about = item.get("about") or {}
    addr = about.get("address") or {}
    geo = about.get("geo") or {}
    offers = item.get("offers") or {}
    contained = about.get("containedInPlace") or {}
    url = item.get("url") or ""
    sid_m = _URL_ID_RE.search(url)
    sid = sid_m.group(1) if sid_m else None
    if not (sid and url):
        return None
    return {
        "source": "dotproperty",
        "source_listing_id": sid,
        "listing_type": "sale",  # search URL is sale-only for now
        "url": url,
        "project_name": contained.get("name") or None,
        "name": item.get("name") or None,
        "description": item.get("description") or None,
        "date_posted": item.get("datePosted") or None,
        "image_url": item.get("image") or None,
        "bedrooms": about.get("numberOfBedrooms"),
        "address_locality": addr.get("addressLocality"),
        "address_region": addr.get("addressRegion"),
        "address_country": addr.get("addressCountry"),
        "street_address": addr.get("streetAddress"),
        "latitude": _safe_float(geo.get("latitude")),
        "longitude": _safe_float(geo.get("longitude")),
        "price": _safe_float(offers.get("price")),
        "price_currency": offers.get("priceCurrency"),
        "availability": offers.get("availability"),
        "position": elem.get("position"),
    }


def scrape(
    city: str = "bangkok",
    listing_type_key: str = "sale_condo",
    max_listings: int | None = None,
    max_pages: int = 2000,
    delay_s: float = 1.0,
) -> Iterator[dict[str, Any]]:
    """Yield normalized listing dicts from DotProperty for a city.

    Args:
      city: slug used in the URL (e.g. "bangkok", "phuket").
      max_listings: stop after yielding this many (None = unbounded).
      max_pages: hard ceiling on pagination (safety).
      delay_s: pause between page fetches.
    """
    path = PATH_TEMPLATES[listing_type_key].format(city=city)
    with httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
        timeout=20.0,
    ) as client:
        yielded = 0
        empty_pages = 0
        last_page = 0
        for page in range(1, max_pages + 1):
            last_page = page
            url = f"{BASE}{path}" + (f"?page={page}" if page > 1 else "")
            try:
                r = client.get(url)
            except Exception as e:
                logger.warning(f"[dotproperty] GET page {page} failed: {e}")
                break
            if r.status_code != 200:
                logger.warning(
                    f"[dotproperty] page {page} status={r.status_code}; stopping"
                )
                break
            elements = _parse_jsonld_itemlist(r.text)
            if not elements:
                empty_pages += 1
                logger.info(
                    f"[dotproperty] page {page}: 0 listings ({empty_pages} empty)"
                )
                if empty_pages >= 2:
                    logger.info("[dotproperty] 2 empty pages in a row; stopping")
                    break
                time.sleep(delay_s)
                continue
            empty_pages = 0
            page_yielded = 0
            for elem in elements:
                norm = _normalize(elem)
                if not norm:
                    continue
                yield norm
                yielded += 1
                page_yielded += 1
                if max_listings is not None and yielded >= max_listings:
                    logger.info(f"[dotproperty] reached cap {max_listings}")
                    return
            logger.info(
                f"[dotproperty] page {page}: +{page_yielded} listings  "
                f"(total: {yielded})"
            )
            time.sleep(delay_s)
        logger.info(
            f"[dotproperty] done — total {yielded} listings across {last_page} pages"
        )
