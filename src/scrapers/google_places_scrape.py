"""Free, proxy-based alternative to google_reviews.py (the paid Places API).

Queries the Google Maps `tbm=map` XHR endpoint through a rotating proxy and
reads a place's star rating + review count from the JSON it returns. Returns
the SAME dict shape as google_reviews.enrich_condo() so the ingest scripts can
persist either source into the same condos columns:

  {"place_id", "display_name", "rating", "review_count", "reviews": []}

WHY this endpoint (and not the /maps/search page):
  The /maps/search HTML page does NOT contain ratings — even for places with
  100k reviews the initial APP_INITIALIZATION_STATE is null-filled; the rating
  is fetched by a later XHR. The tbm=map endpoint IS that data call, returning
  a `)]}'`-prefixed JSON array with the rating inline. Verified 2026-05-30.

EXTRACTION (verified against ICONSIAM = 4.7★ / 7525 reviews):
  data[0][1]                  -> list of result slots
  result[14]                  -> the place array `p`
  p[11]                       -> display name
  p[10]                       -> feature CID ("0x..:0x..")  (NOT a ChIJ id)
  p[4][7]                     -> rating (float)
  p[..][4] == [rating, hist[5], count]  -> rating card; we find it by the
     invariant sum(hist) == count, which makes mis-extraction near-impossible.

Review TEXT is not fetched (reviews=[]). Rating + count is what livability needs.

This is best-effort scraping of a Google property — it will need occasional
maintenance. A sudden spike in no_match means "Google changed the payload",
not "these condos have no reviews".
"""
from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import quote_plus

import httpx
from loguru import logger

# tbm=map data endpoint. !2d{lng}!3d{lat} centre the viewport on the condo so a
# bare project name resolves to the local building; the text query rides in &q=.
_PB = (
    "!4m12!1m3!1d20000!2d{lng}!3d{lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768"
    "!4f13.1!7i20!10b1!12m9!1m1!18b1!2m3!5m1!6e2!20e3!10b1!16b1"
    "!19m4!2m3!1i360!2i120!4i8!20m48!2m2!1i203!2i100!3m2!2i4!5b1"
    "!6m6!1m2!1i86!2i86!1m2!1i408!2i240!7m33!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2"
    "!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2"
    "!1m3!1e10!2b0!3e4!2b1!4b1!9b0!22m3!1e81!12e3!17e15!24m1!1e0"
)
_URL = "https://www.google.com/search?tbm=map&authuser=0&hl=en&gl=th&q={q}&pb={pb}"
# Default viewport centre = central Bangkok (Siam), used when a condo has no coords.
_DEFAULT_LAT, _DEFAULT_LNG = 13.7460, 100.5340

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}
_COOKIES = {"CONSENT": "YES+cb"}

_WORD_RE = re.compile(r"[a-z0-9]+")


class ScrapeFetchError(Exception):
    """Raised when the request itself failed (dead proxy, non-200, blocked
    payload) — as opposed to a successful fetch that simply had no match.
    Lets callers retry on a different proxy instead of recording a false miss.
    """


def _strip_jsonp(text: str) -> Any | None:
    """tbm=map responses are `)]}'\\n<json>`. Strip the guard and parse."""
    body = text
    if body.startswith(")]}'"):
        nl = body.find("\n")
        body = body[nl + 1:] if nl != -1 else body[4:]
    try:
        return json.loads(body)
    except (ValueError, TypeError):
        return None


def _find_rating_card(node: Any) -> tuple[float, int] | None:
    """Depth-first search for the rating card: a list [rating, hist, count]
    where hist is the 1..5-star histogram and sum(hist) == count. That invariant
    makes a false positive essentially impossible. Returns (rating, count)."""
    if isinstance(node, list):
        if (
            len(node) >= 3
            and isinstance(node[0], (int, float))
            and 1.0 <= node[0] <= 5.0
            and isinstance(node[1], list)
            and 1 <= len(node[1]) <= 6
            and all(isinstance(b, int) and b >= 0 for b in node[1])
            and isinstance(node[2], int)
            and node[2] > 0
            and sum(node[1]) == node[2]
        ):
            return float(node[0]), node[2]
        for x in node:
            hit = _find_rating_card(x)
            if hit:
                return hit
    return None


def _norm_tokens(s: str | None) -> set[str]:
    return set(_WORD_RE.findall((s or "").lower()))


def parse_tbm_map(text: str, query_name: str = "") -> dict[str, Any] | None:
    """Parse a tbm=map response into the enrich_condo() shape, or None if no
    usable place was returned. When query_name is given, a place whose name
    shares no significant token with it is rejected (guards against Google
    returning an unrelated nearby place for a condo with no listing)."""
    data = _strip_jsonp(text)
    if not isinstance(data, list):
        return None
    try:
        results = data[0][1]
    except (IndexError, TypeError):
        return None
    if not isinstance(results, list) or not results:
        return None

    # Primary result.
    place = None
    for res in results:
        if isinstance(res, list) and len(res) > 14 and isinstance(res[14], list):
            place = res[14]
            break
    if place is None:
        return None

    name = place[11] if len(place) > 11 and isinstance(place[11], str) else None
    cid = place[10] if len(place) > 10 and isinstance(place[10], str) else None

    # Name-match gate: drop obviously-wrong matches.
    if query_name and name:
        q_tokens = _norm_tokens(query_name) - {"condo", "condominium", "bangkok", "the"}
        if q_tokens and not (q_tokens & _norm_tokens(name)):
            logger.debug(f"  [scrape] name gate: {query_name!r} !~ {name!r} — skip")
            return None

    # Require the rating card (rating + histogram + count, sum-validated). A bare
    # p[4][7] float with no review histogram is a placeholder, not a real
    # rating — storing "4.0 / 0 reviews" would be misleading noise for a value
    # engine. No card => treat as a genuine no-rating result.
    card = _find_rating_card(place)
    if not card:
        return None
    rating, review_count = card
    return {
        "place_id": cid,
        "display_name": name,
        "rating": rating,
        "review_count": review_count,
        "reviews": [],
    }


def enrich_condo_via_scrape(
    name: str,
    proxy: str,
    *,
    lat: float | None = None,
    lng: float | None = None,
    city: str = "Bangkok",
    timeout: float = 30.0,
    save_html_path: str | None = None,
) -> dict[str, Any] | None:
    """Scrape one condo's rating/review_count through `proxy`.

    Returns the enrich_condo() dict, or None when the fetch SUCCEEDED but there
    was no usable rating (a genuine miss). Raises ScrapeFetchError when the
    request itself failed (dead proxy / non-200 / blocked payload) so the caller
    can retry on another proxy rather than recording a false miss."""
    query = f"{name} condo {city}" if city else f"{name} condo"
    url = _URL.format(
        q=quote_plus(query),
        pb=_PB.format(lat=lat if lat is not None else _DEFAULT_LAT,
                      lng=lng if lng is not None else _DEFAULT_LNG),
    )
    try:
        with httpx.Client(
            proxy=proxy, headers=_HEADERS, cookies=_COOKIES,
            timeout=timeout, follow_redirects=True,
        ) as client:
            r = client.get(url)
    except Exception as e:  # noqa: BLE001 — network/proxy error: retryable
        raise ScrapeFetchError(f"{type(e).__name__}: {e}") from e

    if r.status_code != 200:
        raise ScrapeFetchError(f"HTTP {r.status_code}")

    text = r.text
    if save_html_path:
        try:
            with open(save_html_path, "w", encoding="utf-8") as f:
                f.write(text)
        except OSError as e:
            logger.warning(f"  [scrape] could not save response: {e}")

    if not text.startswith(")]}'"):
        # Not the data payload — a consent wall, captcha, or redirect. Retryable.
        raise ScrapeFetchError(f"unexpected payload (len={len(text)})")

    return parse_tbm_map(text, query_name=name)
