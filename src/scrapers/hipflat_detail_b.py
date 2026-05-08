"""hipflat.co.th L3 building detail parser — Phase 2 Tier B.

Tier B = Tier A + everything that requires JS hydration (which nodriver gives
us for free via outerHTML). No separate XHR endpoints needed — the JS bundle
populates the DOM directly, so a post-render outerHTML capture covers it all.

Tier B adds on top of Tier A (`hipflat_detail.parse_detail_html`):
  - Per-unit listings (rent + sale): price, size, bed/bath/floor, publisher
  - Full facilities/amenities (overrides JSON-LD which is sparse)
  - Parking + lifts info
  - Market summary per operation (median, per-area, YoY %)
  - 13-month price chart (median + per-sqm series), JSON-encoded in
    canvas[data-chart-stats] attr
  - Projects nearby (graph data — neighbour project URLs)

Public API:
  parse_detail_html_b(html, url) -> dict   # superset of Tier A dict, adds 'tier_b' key

Schema is additive: existing Tier A consumers see no change; Tier B-aware
persisters dig into result['tier_b'].
"""
from __future__ import annotations

import html as html_module
import json
import re
from typing import Any

from bs4 import BeautifulSoup, Tag
from loguru import logger

from src.scrapers.hipflat_detail import (
    _safe_float,
    _safe_int,
    parse_detail_html,
)

# --------------------------------------------------------------------------
# Regex helpers
# --------------------------------------------------------------------------

# "USD1,171", "฿35,000", "USD2,156"
_PRICE_RE = re.compile(r"(?P<currency>USD|THB|฿)\s?(?P<value>[\d,]+)")
# "USD21/m²", "฿800/m²"
_PER_AREA_RE = re.compile(r"(?P<currency>USD|THB|฿)\s?(?P<value>[\d,]+)\s*/\s*(?:m²|sqm)", re.IGNORECASE)
# "55 m²", "125 m²"
_SIZE_RE = re.compile(r"(?P<n>[\d,.]+)\s*m²")
# "+12.5 % Evolution compared to April 2025"
_EVOLUTION_RE = re.compile(
    r"(?P<sign>[+\-])?\s*(?P<pct>[\d.]+)\s*%\s+Evolution\s+compared\s+to\s+(?P<ref>[A-Za-z]+\s+\d{4})",
    re.IGNORECASE,
)
# Project slug from "/en/projects/some-name-abcdef"
_PROJECT_HASH_RE = re.compile(r"/en/projects/([^/?#]+)$")


# --------------------------------------------------------------------------
# Per-unit extraction
# --------------------------------------------------------------------------

def _extract_units(soup: BeautifulSoup) -> list[dict]:
    """All `div.unit.js-unit-element` in the page (both rent + sale tabs)."""
    units: list[dict] = []
    for unit_el in soup.select("div.unit.js-unit-element"):
        unit = _parse_unit(unit_el)
        if unit:
            units.append(unit)
    return units


def _parse_unit(unit_el: Tag) -> dict | None:
    operation = (unit_el.get("data-unit-operation") or "").upper()
    if operation not in ("RENT", "SALE"):
        return None
    listing_type = "rent" if operation == "RENT" else "sale"

    # Listing detail URL is on the parent <a>
    listing_url: str | None = None
    parent = unit_el.find_parent("a")
    if parent and parent.get("href"):
        listing_url = parent["href"]

    price_text = _text(unit_el.select_one(".price__text__price"))
    per_area_text = _text(unit_el.select_one(".price__text__per-area"))

    price_currency = price = None
    if price_text:
        m = _PRICE_RE.search(price_text)
        if m:
            price = _safe_float(m.group("value"))
            price_currency = m.group("currency").replace("฿", "THB").upper()

    price_per_area = None
    if per_area_text:
        m = _PER_AREA_RE.search(per_area_text)
        if m:
            price_per_area = _safe_float(m.group("value"))

    size_sqm = None
    size_text = _text(unit_el.select_one(".size.characteristic-size"))
    if size_text:
        m = _SIZE_RE.search(size_text)
        if m:
            size_sqm = _safe_float(m.group("n"))

    publisher = _text(unit_el.select_one(".publisher__text"))

    return {
        "source_unit_id": unit_el.get("data-unit-id"),
        "listing_type": listing_type,
        "price": price,
        "price_currency": price_currency,
        "price_per_area": price_per_area,
        "bedrooms": _safe_int(_text(unit_el.select_one(".bedroom.characteristic-size"))),
        "bathrooms": _safe_int(_text(unit_el.select_one(".bathroom.characteristic-size"))),
        "size_sqm": size_sqm,
        "floor_level": _safe_int(_text(unit_el.select_one(".floor.characteristic-size"))),
        "publisher": publisher,
        "listing_url": listing_url,
    }


# --------------------------------------------------------------------------
# Facilities / parking / lifts
# --------------------------------------------------------------------------

def _extract_facilities(soup: BeautifulSoup) -> list[str]:
    """Full feature list — replaces sparse JSON-LD amenityFeature.

    Only the .project-facilities section here (Parking, Gym, Sauna, ...).
    project-parking-and-lifts is structured differently (handled separately).
    """
    out: list[str] = []
    sec = soup.select_one(".facilities-section.project-facilities")
    if not sec:
        return out
    for li in sec.select("li.facilities-section__item"):
        name = li.get_text(strip=True)
        if name:
            out.append(name)
    return out


def _extract_parking_and_lifts(soup: BeautifulSoup) -> list[dict]:
    """`.project-parking-and-lifts li` → list of {key, value}.

    Items can be either plain strings ("Number of lifts: 4") or have a
    structured value span ("Charging stations on site: <span>no</span>").
    """
    out: list[dict] = []
    sec = soup.select_one(".facilities-section.project-parking-and-lifts")
    if not sec:
        return out
    for li in sec.select("li.facilities-section__item"):
        value_el = li.select_one(".facilities-section__item-value")
        if value_el:
            value = value_el.get_text(strip=True)
            # The key is the li text minus the value span
            value_el.extract()
            key = li.get_text(strip=True).rstrip(":").strip()
            out.append({"key": key, "value": value})
        else:
            txt = li.get_text(strip=True)
            if ":" in txt:
                k, v = txt.split(":", 1)
                out.append({"key": k.strip(), "value": v.strip()})
            else:
                out.append({"key": txt, "value": None})
    return out


# --------------------------------------------------------------------------
# Market insights — summary + chart
# --------------------------------------------------------------------------

def _extract_market_summary(soup: BeautifulSoup) -> list[dict]:
    """`.market-stats__by-operation__summary` blocks (one per operation)."""
    out: list[dict] = []
    for sm in soup.select(".market-stats__by-operation__summary"):
        title = _text(sm.select_one(".market-stats__by-operation__summary__title")) or ""
        period = "rent" if "rent" in title.lower() else "sale" if "sale" in title.lower() else None

        median_text = _text(sm.select_one(".market-stats__by-operation__summary__price.median")) or ""
        per_area_text = _text(sm.select_one(".market-stats__by-operation__summary__price.per-area")) or ""
        progress_text = _text(sm.select_one(".market-stats__by-operation__summary__progress")) or ""

        median = currency = None
        if median_text:
            m = _PRICE_RE.search(median_text)
            if m:
                median = _safe_float(m.group("value"))
                currency = m.group("currency").replace("฿", "THB").upper()
        per_area = None
        if per_area_text:
            m = _PRICE_RE.search(per_area_text)
            if m:
                per_area = _safe_float(m.group("value"))

        yoy_pct = None
        yoy_ref = None
        if progress_text:
            m = _EVOLUTION_RE.search(progress_text)
            if m:
                pct = _safe_float(m.group("pct"))
                if pct is not None:
                    yoy_pct = -pct if m.group("sign") == "-" else pct
                yoy_ref = m.group("ref")

        out.append({
            "period": period,
            "median_price": median,
            "median_per_sqm": per_area,
            "currency": currency,
            "yoy_pct": yoy_pct,
            "yoy_reference": yoy_ref,
        })
    return out


def _extract_price_charts(soup: BeautifulSoup, operations_in_dom_order: list[str]) -> list[dict]:
    """canvas[data-chart-stats] → list of {period, metric, currency, points}.

    Single canvas per page. For each operation present in DOM order, the
    canvas data-chart-stats array contains 2 consecutive series:
      [N]   metric=price    (currencyStringFormat="USD%s")
      [N+1] metric=per_sqm  (currencyStringFormat="USD%s/sqm")
    so series index `i` belongs to operation `operations_in_dom_order[i // 2]`.

    `operations_in_dom_order` is the ordered list of "rent"/"sale" derived
    from the .market-stats__by-operation__summary__title blocks in the page,
    so the period mapping stays in lockstep with hipflat's own ordering.
    """
    out: list[dict] = []
    canvases = soup.select("canvas[data-chart-stats]")
    if not canvases:
        return out
    # In practice there's exactly one canvas per page; keep it general.
    for canvas in canvases:
        raw = canvas.get("data-chart-stats") or ""
        if not raw:
            continue
        decoded = html_module.unescape(raw)
        try:
            series = json.loads(decoded)
        except json.JSONDecodeError as e:
            logger.warning(f"[hipflat_detail_b] chart JSON parse failed: {e}")
            continue
        if not isinstance(series, list):
            continue

        for i, s in enumerate(series):
            if not isinstance(s, dict):
                continue
            fmt = s.get("currencyStringFormat") or ""
            data_points = s.get("data") or []
            metric = "per_sqm" if "/sqm" in fmt or "/m²" in fmt else "price"
            currency_match = re.match(r"([A-Z]{3}|฿)", fmt)
            currency = (currency_match.group(1).replace("฿", "THB") if currency_match else None)
            # Two series per operation, in DOM order. Fall back to None if the
            # operation list ran out (defensive — shouldn't happen).
            op_idx = i // 2
            period = (
                operations_in_dom_order[op_idx]
                if 0 <= op_idx < len(operations_in_dom_order)
                else None
            )
            normalised_points: list[dict] = []
            for p in data_points:
                if not isinstance(p, dict):
                    continue
                normalised_points.append({
                    "date": p.get("date"),
                    "value": _safe_float(p.get("value")),
                })
            if normalised_points:
                out.append({
                    "period": period,
                    "metric": metric,
                    "currency": currency,
                    "points": normalised_points,
                })
    return out


# --------------------------------------------------------------------------
# Projects nearby (graph data)
# --------------------------------------------------------------------------

def _extract_neighbours(soup: BeautifulSoup) -> list[dict]:
    """`div.projectNearby__content a[href*="/en/projects/"]` → list of
    {url, slug, name}. Dedup by slug."""
    seen: set[str] = set()
    out: list[dict] = []
    for content in soup.select("div.projectNearby__content"):
        for a in content.select("a[href*='/en/projects/']"):
            href = a.get("href") or ""
            m = _PROJECT_HASH_RE.search(href)
            if not m:
                continue
            slug = m.group(1)
            if slug in seen:
                continue
            seen.add(slug)
            out.append({
                "url": href,
                "slug": slug,
                "name": (a.get("title") or a.get_text(strip=True) or "").strip() or None,
            })
    return out


# --------------------------------------------------------------------------
# Glue
# --------------------------------------------------------------------------

def _text(el: Tag | None) -> str | None:
    if el is None:
        return None
    t = el.get_text(strip=True)
    return t or None


def parse_detail_html_b(html: str, url: str | None = None) -> dict:
    """Tier A + Tier B in one dict.

    Returns the Tier-A dict augmented with:
      - 'tier_b': {
            'units': [...],
            'facilities': [...],         # full set, prefer over Tier-A 'amenities'
            'parking_and_lifts': [...],
            'market_summary': [...],
            'price_charts': [...],
            'neighbours': [...],
            '_signal_completeness': { has_units, has_facilities, has_chart, ... }
        }
    """
    base = parse_detail_html(html, url=url)
    soup = BeautifulSoup(html, "html.parser")

    facilities = _extract_facilities(soup)
    units = _extract_units(soup)
    parking = _extract_parking_and_lifts(soup)
    market = _extract_market_summary(soup)
    operations_in_dom_order = [m["period"] for m in market if m.get("period")]
    charts = _extract_price_charts(soup, operations_in_dom_order)
    neighbours = _extract_neighbours(soup)

    base["tier_b"] = {
        "units": units,
        "facilities": facilities,  # caller may overwrite tier-A amenities with this
        "parking_and_lifts": parking,
        "market_summary": market,
        "price_charts": charts,
        "neighbours": neighbours,
        "_signal_completeness": {
            "has_units": bool(units),
            "n_units": len(units),
            "has_facilities": bool(facilities),
            "n_facilities": len(facilities),
            "has_market": bool(market),
            "has_chart": bool(charts),
            "n_chart_points": sum(len(c["points"]) for c in charts),
            "has_neighbours": bool(neighbours),
            "n_neighbours": len(neighbours),
        },
    }
    return base
