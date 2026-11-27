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
# A monthly CAM fee for one unit, in baht. Mirrors web/lib/camFee.ts.
CAM_FEE_MIN = 200
CAM_FEE_MAX = 60_000
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
            # The chip is not always a monthly fee: it has carried a per-sqm
            # rate (฿35) and, where the markup shifts, a price (฿20,199,600
            # "per month"). 45 such rows were live on condo pages until
            # 2026-10-04. Same band as web/lib/camFee.ts — change both.
            cam = _commafloat(m.group(1))
            if cam is not None and CAM_FEE_MIN <= cam <= CAM_FEE_MAX:
                extras["cam_fee_per_month"] = cam
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


# --- Search page layout "s2" (live by 2026-11-22) ----------------------------
# FazWaz replaced .result-search__item + the onmouseenter JSON bridge with
# <article class="s2-card" data-id=.. data-m='{"a":area,"f":floor,"b":beds,
# "p":price}'>. Everything else is plain markup: project name/link in
# .s2-pname, address in .s2-where, nearest station in .s2-place, pills for
# quota/year, and the "more" drawer for CAM fee and estimated rent/yield.
# The old parser matched nothing from then on, every city ended after two
# "parsed 0 cards" pages, and fazwaz fell to zero active listings.
S2_CARD_SELECTOR = "article.s2-card[data-id]"
S2_DIST_RE = re.compile(r"([\d.,]+)\s*(km|m)\s+to\s+(.+)$", flags=re.IGNORECASE)
S2_TRANSIT_RE = re.compile(r"\b(BTS|MRT|ARL|SRT|BRT)\b\s*$", flags=re.IGNORECASE)
S2_YIELD_RE = re.compile(r"([\d.]+)\s*%\s*yield", flags=re.IGNORECASE)
S2_RENT_RE = re.compile(r"rent\s*≈?\s*฿\s*([\d,]+)", flags=re.IGNORECASE)
S2_BUILT_RE = re.compile(r"Built:?\s*(\d{4})", flags=re.IGNORECASE)
S2_FACT_SKIP = {"s2i-bed", "s2i-bath", "s2i-size"}


def _s2_text(el) -> str | None:
    if el is None:
        return None
    t = el.get_text(" ", strip=True).replace("\xa0", " ")
    return t or None


def _s2_transit(card) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in card.select(".s2-place"):
        t = _s2_text(p) or ""
        m = S2_DIST_RE.search(t)
        if not m:
            continue
        v = _commafloat(m.group(1))
        km = None if v is None else (v / 1000 if m.group(2).lower() == "m" else v)
        where = m.group(3).strip()
        lm = S2_TRANSIT_RE.search(where)
        out.append({
            "label": lm.group(1).upper() if lm else None,
            "station": (where[: lm.start()].strip() if lm else where) or None,
            "distance_km": round(km, 3) if km is not None else None,
        })
    return out


def _parse_s2_card(card, listing_type: str) -> dict[str, Any] | None:
    sid = card.get("data-id")
    try:
        meta = json.loads(card.get("data-m") or "{}")
    except json.JSONDecodeError:
        meta = {}

    price = meta.get("p")
    if not price:
        price = _thb_to_float(_s2_text(card.select_one(".s2-price b")))
    try:
        price = float(price) if price else None
    except (TypeError, ValueError):
        price = None
    if not price:
        return None

    pname = card.select_one(".s2-pname a") or card.select_one(".s2-pname")
    project_name = (_s2_text(pname) or "").strip()
    if not project_name:
        return None
    project_url = _absolutize(pname.get("href")) if pname is not None and pname.name == "a" else None

    area = meta.get("a")
    if area is None:
        m = AREA_RE.search(_s2_text(card.select_one(".s2i-size")) or "")
        area = float(m.group(1)) if m else None
    try:
        area = float(area) if area else None
    except (TypeError, ValueError):
        area = None

    bath_el = card.select_one(".s2-fact.s2i-bath")
    prop_type = None
    for f in card.select(".s2-fact"):
        if not S2_FACT_SKIP.intersection(f.get("class") or []):
            prop_type = _s2_text(f)
            break

    address = _s2_text(card.select_one(".s2-where"))
    sub, district, province = _split_address(address)

    price_a = card.select_one("a.s2-price") or card.select_one("a.s2-ph")
    detail_url = _absolutize(price_a.get("href")) if price_a is not None else None

    year_built = ownership = None
    for pill in card.select(".s2-pills .tag"):
        t = _s2_text(pill) or ""
        m = S2_BUILT_RE.search(t)
        if m:
            year_built = int(m.group(1))
        elif "Quota" in t and ownership is None:
            ownership = t

    more = " ".join(_s2_text(d) or "" for d in card.select(".s2-more dd"))
    est_rent = provided_yield = cam = sink = None
    if more:
        m = S2_RENT_RE.search(more)
        if m:
            est_rent = _commafloat(m.group(1))
        m = S2_YIELD_RE.search(more)
        if m:
            provided_yield = _commafloat(m.group(1))
        m = CAM_RE.search(more)
        if m:
            v = _commafloat(m.group(1))
            if v is not None and CAM_FEE_MIN <= v <= CAM_FEE_MAX:
                cam = v
        m = SINK_RE.search(more)
        if m:
            sink = _commafloat(m.group(1))

    img = card.select_one(".s2-ph img, .lm-pds img, img")
    thumb = None
    if img is not None:
        thumb = img.get("src") or img.get("data-src")

    return {
        "source": "fazwaz",
        "source_listing_id": sid,
        "name": project_name,
        "url": detail_url,
        "project_url": project_url,
        "listing_type": listing_type,
        "price": price,
        # The s2 card no longer prints ฿/SqM; derive it like the page does.
        "price_per_sqm": round(price / area, 2) if area else None,
        "area_sqm": area,
        "bedrooms": _to_smallint(meta.get("b")),
        "bathrooms": _to_smallint(_s2_text(bath_el)),
        "property_type": prop_type or "Condo",
        "address": address,
        "subdistrict": sub,
        "district": district,
        "province": province,
        "transit": _s2_transit(card),
        "year_built": year_built,
        "ownership": ownership,
        "est_rent_per_month": est_rent,
        "provided_yield_pct": provided_yield,
        "cam_fee_per_month": cam,
        "sinking_fund": sink,
        "thumbnail": thumb,
    }


def parse_cards(html: str, listing_type: str = "sale") -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    s2 = soup.select(S2_CARD_SELECTOR)
    if s2:
        out_s2: list[dict[str, Any]] = []
        seen: set[str] = set()
        for card in s2:
            sid = card.get("data-id")
            if not sid or sid in seen:
                continue
            item = _parse_s2_card(card, listing_type)
            if item:
                out_s2.append(item)
                seen.add(sid)
        return out_s2

    # Legacy layout (before 2026-11).
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
