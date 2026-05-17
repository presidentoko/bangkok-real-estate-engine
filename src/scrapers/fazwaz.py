"""FazWaz HTML scraper.

Each search-result card on FazWaz embeds the listing as JSON inside the
card's `onmouseenter` attribute (passed to a JS bridge function). That
JSON carries:
  name, price (Thai-baht string), area, bedrooms, bathrooms, propertyType,
  formatted_address, detailUrl, thumbnail, nearPlaceGroup[]

Plus the card DOM yields extras the JSON omits:
  price_per_sqm                       (from price-tag "(฿207,000/SqM)")
  est_rent / provided_yield_pct       (from manage-tag chips)
  cam_fee / sinking_fund / freshness  (also from chips)

Returns long-form list of dicts ready for upsert_fazwaz_*.
"""
from __future__ import annotations

import json
import re
from html import unescape
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from bs4 import BeautifulSoup
from loguru import logger

BASE_URL = "https://www.fazwaz.com"

# Card detection
CARD_SELECTOR = ".result-search__item"
JSON_RE = re.compile(
    r"callFuncIfExists\(\s*'bridgeSearchMouseOver'\s*,\s*\d+\s*,\s*'(.+?)'\s*\)",
    flags=re.DOTALL,
)
THB_RE = re.compile(r"฿\s*([\d,]+(?:\.\d+)?)\s*([MK])?", flags=re.IGNORECASE)
PPS_RE = re.compile(r"\(\s*฿\s*([\d,]+)\s*/\s*SqM\s*\)", flags=re.IGNORECASE)
AREA_RE = re.compile(r"([\d.]+)\s*SqM", flags=re.IGNORECASE)
ROI_RE = re.compile(r"ROI[:\s]*([\d.]+)\s*%", flags=re.IGNORECASE)
REVISITED_RE = re.compile(r"Est\.?\s*Rent[:\s]*฿([\d,]+)", flags=re.IGNORECASE)
CAM_RE = re.compile(r"CAM\s*Fee[:\s]*฿([\d,]+)", flags=re.IGNORECASE)
SINK_RE = re.compile(r"Sinking\s*Fund[:\s]*฿([\d,]+)", flags=re.IGNORECASE)


def _thb_to_float(s: str | None) -> float | None:
    if not s:
        return None
    m = THB_RE.search(s)
    if not m:
        try:
            return float(s.replace(",", "").replace("฿", "").strip())
        except ValueError:
            return None
    v = float(m.group(1).replace(",", ""))
    unit = (m.group(2) or "").upper()
    if unit == "M":
        v *= 1_000_000
    elif unit == "K":
        v *= 1_000
    return v


def _commafloat(s: str | None) -> float | None:
    if s is None:
        return None
    try:
        return float(s.replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _to_smallint(v: Any) -> int | None:
    """Coerce a possibly-fractional room count to int — listings.bathrooms
    is `smallint` in Postgres and rejects 1.5. Round half-baths down so
    1.5 → 1, matching the conventional 'whole bathrooms' interpretation."""
    if v is None:
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _extract_json_from_card(card) -> dict[str, Any] | None:
    """Pull the bridgeSearchMouseOver JSON payload out of the card's
    onmouseenter attribute. Returns dict or None.
    """
    attr = card.get("onmouseenter") or ""
    if not attr:
        return None
    m = JSON_RE.search(attr)
    if not m:
        return None
    raw = unescape(m.group(1))
    # The JSON has unicode-escaped chars + escaped slashes; json.loads handles that.
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Some payloads embed double-escaped quotes — try unescaping once more
        try:
            return json.loads(unescape(raw))
        except json.JSONDecodeError as e:
            logger.debug(f"[fazwaz] card JSON decode failed: {e}")
            return None


def _absolutize(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http"):
        return url
    return BASE_URL + (url if url.startswith("/") else "/" + url)


def _split_address(formatted: str | None) -> tuple[str | None, str | None, str | None]:
    """'Khlong Toei Nuea, Watthana, Bangkok' → (subdistrict, district, province)."""
    if not formatted:
        return None, None, None
    parts = [p.strip() for p in formatted.split(",") if p.strip()]
    parts = (parts + [None, None, None])[:3]
    return parts[0], parts[1], parts[2]


def _parse_card_extras(card) -> dict[str, Any]:
    extras: dict[str, Any] = {}

    price_tag = card.select_one(".price-tag")
    if price_tag:
        text = price_tag.get_text(" ", strip=True)
        pps = PPS_RE.search(text)
        if pps:
            extras["price_per_sqm"] = _commafloat(pps.group(1))

    chips_text = " ".join(t.get_text(" ", strip=True) for t in card.select(".manage-tag__item"))
    if chips_text:
        m = REVISITED_RE.search(chips_text)
        if m:
            extras["est_rent_per_month"] = _commafloat(m.group(1))
        m = ROI_RE.search(chips_text)
        if m:
            extras["provided_yield_pct"] = _commafloat(m.group(1))
        m = CAM_RE.search(chips_text)
        if m:
            extras["cam_fee_per_month"] = _commafloat(m.group(1))
        m = SINK_RE.search(chips_text)
        if m:
            extras["sinking_fund"] = _commafloat(m.group(1))

    # Year built / ownership type from basic-info blocks
    for b in card.select(".unit-info__basic-info"):
        t = b.get_text(" ", strip=True)
        if t.startswith("Year Built"):
            m = re.search(r"Year Built\s*(\d{4})", t)
            if m:
                extras["year_built"] = int(m.group(1))
        elif "Quota" in t:
            extras["ownership"] = t.replace("\xa0", " ").strip()

    return extras


def _project_url_from_anchors(card) -> str | None:
    """Pick a /projects/.../<slug> URL (canonical project page) when present."""
    for a in card.select("a[href]"):
        h = a.get("href") or ""
        if "/projects/" in h:
            return _absolutize(h)
    return None


def parse_cards(html: str, listing_type: str = "sale") -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(CARD_SELECTOR)
    out: list[dict[str, Any]] = []
    seen_sids: set[str] = set()

    for card in cards:
        sid = card.get("data-id")
        if not sid or sid in seen_sids:
            continue

        payload = _extract_json_from_card(card)
        if not payload:
            continue

        price = _thb_to_float(payload.get("price"))
        if not price:
            continue

        project_name = (payload.get("name") or "").strip()
        if not project_name:
            continue

        area = None
        if payload.get("area"):
            m = AREA_RE.search(str(payload["area"]))
            if m:
                area = float(m.group(1))

        sub, district, province = _split_address(payload.get("formatted_address"))

        detail_url = _absolutize(payload.get("detailUrl"))
        project_url = _project_url_from_anchors(card)

        # Nearby transit (BTS/MRT/ARL distances in km)
        transit: list[dict[str, Any]] = []
        for n in payload.get("nearPlaceGroup") or []:
            d = n.get("distance") or ""
            mkm = re.search(r"([\d.]+)\s*km", d)
            km = float(mkm.group(1)) if mkm else None
            transit.append({
                "label": n.get("label"),
                "station": (n.get("tooltip") or "").strip() or None,
                "distance_km": km,
            })

        extras = _parse_card_extras(card)

        out.append({
            "source": "fazwaz",
            "source_listing_id": sid,
            "name": project_name,
            "url": detail_url,
            "project_url": project_url,
            "listing_type": listing_type,
            "price": price,
            "price_per_sqm": extras.get("price_per_sqm"),
            "area_sqm": area,
            "bedrooms": _to_smallint(payload.get("bedrooms")),
            "bathrooms": _to_smallint(payload.get("bathrooms")),
            "property_type": (payload.get("propertyType") or "Condo"),
            "address": payload.get("formatted_address"),
            "subdistrict": sub,
            "district": district,
            "province": province,
            "transit": transit,
            "year_built": extras.get("year_built"),
            "ownership": extras.get("ownership"),
            "est_rent_per_month": extras.get("est_rent_per_month"),
            "provided_yield_pct": extras.get("provided_yield_pct"),
            "cam_fee_per_month": extras.get("cam_fee_per_month"),
            "sinking_fund": extras.get("sinking_fund"),
            "thumbnail": payload.get("thumbnail"),
        })
        seen_sids.add(sid)

    return out


def page_url(base_path: str, page_num: int) -> str:
    """e.g. ('/property-for-sale/thailand/bangkok', 2) → '...?page=2'"""
    parts = urlsplit(BASE_URL + base_path)
    query = f"page={page_num}" if page_num > 1 else ""
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))
