"""hipflat.co.th L3 building detail parser — Phase 2 Tier A.

Tier A extracts everything that's present in the *initial HTML response* (no
JS hydration needed):
  - JSON-LD ApartmentComplex: lat/lng, amenities, address
  - JSON-LD FAQPage: nearest BTS/MRT, available units count, price range
  - section.title: name, address text, headline price
  - section.characteristics: completion date, floors, total units
  - section.description: free-text overview

Tier B (per-unit listings + price-history chart) requires JS render and lives
in a future module — *not* this one.

Public API:
  parse_detail_html(html, url) -> dict   # pure parser, used by tests + fetcher
  async fetch_detail(url, browser)       # nodriver-driven fetch + parse
"""
from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from loguru import logger

# --------------------------------------------------------------------------
# Pure parsing (no I/O) — testable against saved fixtures.
# --------------------------------------------------------------------------

# Match e.g. "BTS Phrom Phong", "MRT Sukhumvit", "ARL Makkasan".
# Station names are TitleCase, possibly multi-word (e.g. "Thong Lo", "Mo Chit").
# Stops at lowercase words ("and", "are", "is"), commas, or end of text.
_TRANSIT_RE = re.compile(
    r"\b(BTS|MRT|ARL|SRT)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)"
)
_TRANSIT_TRAILING_STOPS = ("station", "stations", "are", "is", "and")
# Matches both:
#   "5 units for rent starting from USD1,000 / month up to USD2,000 / month"
#   "1 units for sale starting from USD30,498."   (single unit → no upper bound)
_PRICE_RANGE_RE = re.compile(
    r"(?P<count>\d+)\s+units?\s+for\s+(?P<period>rent|sale).+?from\s+"
    r"(?P<currency>USD|THB|฿)\s?(?P<min>[\d,]+)"
    r"(?:.+?to\s+(?P=currency)\s?(?P<max>[\d,]+))?",
    re.IGNORECASE | re.DOTALL,
)
_HEADLINE_PRICE_RE = re.compile(
    r"(?P<currency>USD|THB|฿)\s?(?P<value>[\d,]+)\s*(?:/\s*(?P<period>month|year))?",
    re.IGNORECASE,
)
# "May 2017", "January 2020", "2018"
_COMPLETION_RE = re.compile(
    r"(?:(?P<month>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?"
    r"(?P<year>(?:19|20)\d{2})"
)
# In description: "It has 14 units across 6 floors"  → real building total.
# (section.characteristics .units shows *currently listed* count, not project total.)
_DESCRIPTION_TOTAL_RE = re.compile(
    r"(?:has|with)\s+(?P<units>\d+)\s+units?\s+across\s+(?P<floors>\d+)\s+floors?",
    re.IGNORECASE,
)


def _safe_int(s: Any) -> int | None:
    if s is None:
        return None
    try:
        return int(str(s).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _safe_float(s: Any) -> float | None:
    if s is None:
        return None
    try:
        return float(str(s).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _extract_jsonld(soup: BeautifulSoup) -> list[dict]:
    """Return all JSON-LD objects on the page, flattened (top-level arrays unwrapped)."""
    out: list[dict] = []
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = script.string or script.get_text() or ""
        text = text.strip()
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning(f"[hipflat_detail] JSON-LD parse failed: {e}")
            continue
        if isinstance(data, list):
            out.extend(d for d in data if isinstance(d, dict))
        elif isinstance(data, dict):
            out.append(data)
    return out


def _find_jsonld(blocks: list[dict], type_name: str) -> dict | None:
    for b in blocks:
        t = b.get("@type")
        if t == type_name or (isinstance(t, list) and type_name in t):
            return b
    return None


def _extract_apartment(blocks: list[dict]) -> dict:
    """ApartmentComplex JSON-LD → flat dict."""
    ac = _find_jsonld(blocks, "ApartmentComplex") or {}
    geo = ac.get("geo") or {}
    addr = ac.get("address") or {}
    amenities = []
    for a in ac.get("amenityFeature") or []:
        n = (a or {}).get("name") if isinstance(a, dict) else None
        if n:
            amenities.append(n.strip())
    available = ac.get("numberOfAvailableAccommodationUnits") or {}
    if isinstance(available, dict):
        available = available.get("value")

    return {
        "name": ac.get("name"),
        "description": ac.get("description"),
        "image": ac.get("image"),
        "url": ac.get("url"),
        "latitude": _safe_float(geo.get("latitude")),
        "longitude": _safe_float(geo.get("longitude")),
        "address_street": addr.get("streetAddress"),
        "address_locality": addr.get("addressLocality"),
        "address_region": addr.get("addressRegion"),
        "address_postal_code": addr.get("postalCode"),
        "address_country": (addr.get("addressCountry") or {}).get("name")
            if isinstance(addr.get("addressCountry"), dict) else addr.get("addressCountry"),
        "amenities": amenities,
        "available_units_count": _safe_int(available),
    }


def _parse_transit_from_text(text: str) -> list[dict]:
    """'BTS Ekkamai, BTS Phrom Phong and BTS Thong Lo' → [{line, station}]."""
    out: list[dict] = []
    seen = set()
    for m in _TRANSIT_RE.finditer(text):
        line, station = m.group(1), m.group(2).strip()
        # Strip trailing words that snuck into the TitleCase run
        # (e.g. "Phrom Phong Station" → "Phrom Phong").
        parts = station.split()
        while parts and parts[-1].lower() in _TRANSIT_TRAILING_STOPS:
            parts.pop()
        station = " ".join(parts)
        if not station:
            continue
        key = (line, station.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append({"line": line, "station": station})
    return out


def _extract_faq(blocks: list[dict]) -> dict:
    """FAQPage JSON-LD → {transit: [...], price_range: {...}}.

    When a building has BOTH sale and rent price Q&As (common), keep the one
    with more available units — it's the higher-signal listing.
    """
    faq = _find_jsonld(blocks, "FAQPage") or {}
    transit: list[dict] = []
    price_candidates: list[dict] = []
    for q in faq.get("mainEntity") or []:
        if not isinstance(q, dict):
            continue
        ans = (q.get("acceptedAnswer") or {}).get("text") or ""
        name = q.get("name") or ""
        if any(k in name for k in ("BTS", "MRT", "stations")) or any(k in ans for k in ("BTS", "MRT", "ARL")):
            transit.extend(_parse_transit_from_text(ans))
        m = _PRICE_RANGE_RE.search(ans)
        if m:
            price_candidates.append({
                "available_units_count": _safe_int(m.group("count")),
                "price_period": m.group("period").lower(),
                "price_currency": m.group("currency").replace("฿", "THB").upper(),
                "price_min": _safe_float(m.group("min")),
                "price_max": _safe_float(m.group("max")),
            })
    price_info = max(
        price_candidates,
        key=lambda p: p.get("available_units_count") or 0,
    ) if price_candidates else None

    seen = set()
    transit_dedup = []
    for t in transit:
        k = (t["line"], t["station"].lower())
        if k not in seen:
            seen.add(k)
            transit_dedup.append(t)
    return {"transit": transit_dedup, "price_info": price_info}


def _extract_characteristics(soup: BeautifulSoup) -> dict:
    """section.characteristics → completion_year, floors, units_listed.

    NOTE: the .units block in this section is hipflat's *currently listed* count
    on the page, NOT the building's total unit count. Real total comes from the
    description text via _DESCRIPTION_TOTAL_RE.
    """
    sec = soup.select_one("section.characteristics")
    out: dict = {"completion_year": None, "floors": None, "units_listed": None}
    if not sec:
        return out
    for div in sec.find_all("div"):
        cls = " ".join(div.get("class") or [])
        data_el = div.find(class_="data")
        if not data_el:
            continue
        data_text = data_el.get_text(strip=True)
        if "completed" in cls.lower():
            m = _COMPLETION_RE.search(data_text)
            if m:
                out["completion_year"] = _safe_int(m.group("year"))
        elif "floor" in cls.lower():
            out["floors"] = _safe_int(data_text)
        elif "units" in cls.lower():
            out["units_listed"] = _safe_int(data_text)
    return out


def _extract_total_from_description(description: str | None) -> tuple[int | None, int | None]:
    """'It has 14 units across 6 floors' → (14, 6).  Either may be None."""
    if not description:
        return None, None
    m = _DESCRIPTION_TOTAL_RE.search(description)
    if not m:
        return None, None
    return _safe_int(m.group("units")), _safe_int(m.group("floors"))


def _extract_title_block(soup: BeautifulSoup) -> dict:
    """section.title → headline name/address/price (fallback when JSON-LD lacks it)."""
    sec = soup.select_one("section.title")
    out: dict = {"name": None, "address_text": None, "headline_price": None}
    if not sec:
        return out
    h1 = sec.find("h1")
    if h1:
        out["name"] = h1.get_text(strip=True)
    loc = sec.select_one(".location")
    if loc:
        out["address_text"] = loc.get_text(strip=True)
    price_value = sec.select_one(".price .value")
    if price_value:
        text = price_value.get_text(strip=True)
        m = _HEADLINE_PRICE_RE.search(text)
        if m:
            out["headline_price"] = {
                "currency": m.group("currency").replace("฿", "THB").upper(),
                "value": _safe_float(m.group("value")),
                "period": (m.group("period") or "").lower() or None,
                "raw": text,
            }
    return out


def parse_detail_html(html: str, url: str | None = None) -> dict:
    """Turn raw L3 HTML into a normalised dict ready for db.upsert.

    Always returns a dict; missing fields are None / [] rather than raising,
    so partial pages (e.g. a building with no FAQ block) still enrich what's
    available.
    """
    soup = BeautifulSoup(html, "html.parser")
    blocks = _extract_jsonld(soup)
    apt = _extract_apartment(blocks)
    faq = _extract_faq(blocks)
    chars = _extract_characteristics(soup)
    title = _extract_title_block(soup)

    name = apt.get("name") or title.get("name")
    description = apt.get("description")
    address = apt.get("address_street") or title.get("address_text")
    available = apt.get("available_units_count")
    if available is None and faq["price_info"]:
        available = faq["price_info"]["available_units_count"]

    price_info = faq["price_info"] or {}

    # Real building total comes from description text. Fall back to char.floors.
    total_units, floors_from_desc = _extract_total_from_description(description)
    floors = chars.get("floors") or floors_from_desc

    return {
        "url": url or apt.get("url"),
        "name": name,
        "description": description,
        "address": address,
        "address_locality": apt.get("address_locality"),
        "address_region": apt.get("address_region"),
        "address_postal_code": apt.get("address_postal_code") or None,
        "latitude": apt.get("latitude"),
        "longitude": apt.get("longitude"),
        "completion_year": chars.get("completion_year"),
        "floors": floors,
        "total_units": total_units,
        "units_listed": chars.get("units_listed"),
        "available_units_count": available,
        "price_min": price_info.get("price_min"),
        "price_max": price_info.get("price_max"),
        "price_currency": price_info.get("price_currency"),
        "price_period": price_info.get("price_period"),
        "headline_price": title.get("headline_price"),
        "hero_image_url": apt.get("image"),
        "amenities": apt.get("amenities") or [],
        "transit": faq["transit"],
        # diagnostic — true if the rich Tier-A signals all came through
        "_signal_completeness": _completeness(apt, faq, chars, total_units),
    }


def _completeness(apt: dict, faq: dict, chars: dict, total_units: int | None) -> dict:
    return {
        "has_geo": apt.get("latitude") is not None and apt.get("longitude") is not None,
        "has_amenities": bool(apt.get("amenities")),
        "has_chars": chars.get("completion_year") is not None and chars.get("floors") is not None,
        "has_total_units": total_units is not None,
        "has_transit": bool(faq["transit"]),
        "has_price_range": faq["price_info"] is not None,
    }


# --------------------------------------------------------------------------
# Live fetch (nodriver) — used by enrich_buildings.py
# --------------------------------------------------------------------------

POST_NAV_PAUSE_S = 1.5

# Per-step nodriver timeouts. Without these, a hard Cloudflare challenge or
# unresponsive page can hang an await forever (Tier B silently stalled 1.5h
# on 2026-05-07 because verify_cf() never returned).
GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 30
EVALUATE_TIMEOUT_S = 15


async def fetch_detail(
    url: str,
    browser,
    *,
    label: str = "",
    save_html_to: str | None = None,
) -> dict | None:
    """Open url with the given nodriver browser, return parsed dict or None.

    If save_html_to is given, also write the raw outerHTML to that path.
    """
    import asyncio
    from pathlib import Path
    label = label or url.rsplit("/", 1)[-1]
    try:
        tab = await asyncio.wait_for(browser.get(url), timeout=GOTO_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning(f"[hipflat_detail] {label} goto timed out after {GOTO_TIMEOUT_S}s")
        return None
    except Exception as e:
        logger.warning(f"[hipflat_detail] {label} goto failed: {e}")
        return None
    try:
        await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.warning(f"[hipflat_detail] {label} verify_cf timed out — skipping")
        return None
    except Exception as e:
        # nodriver raises NoneType when no challenge present — that's the happy path.
        logger.debug(f"[hipflat_detail] {label} verify_cf: {e}")
    try:
        await tab.sleep(POST_NAV_PAUSE_S)
    except Exception:
        await asyncio.sleep(POST_NAV_PAUSE_S)
    try:
        # outerHTML reflects whatever the DOM is at this instant; for Tier A
        # the JSON-LD + section.* are SSR-rendered and present immediately.
        from src.scrapers.hipflat import _unwrap
        html = _unwrap(
            await asyncio.wait_for(
                tab.evaluate("document.documentElement.outerHTML"),
                timeout=EVALUATE_TIMEOUT_S,
            )
        )
    except asyncio.TimeoutError:
        logger.warning(f"[hipflat_detail] {label} outerHTML timed out")
        return None
    except Exception as e:
        logger.warning(f"[hipflat_detail] {label} get HTML failed: {e}")
        return None
    if not isinstance(html, str) or len(html) < 1000:
        logger.warning(f"[hipflat_detail] {label} HTML suspiciously small ({len(html) if isinstance(html, str) else 'NA'} bytes)")
        return None
    if save_html_to:
        Path(save_html_to).write_text(html, encoding="utf-8")
    return parse_detail_html(html, url=url)
