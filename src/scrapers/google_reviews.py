"""Google Places API (New) — find a condo and fetch its rating + reviews.

Uses the v1 Places API (https://places.googleapis.com/v1/...). Two calls per
condo:
  1) places:searchText  → resolve project name → place_id
  2) places/{place_id}  → rating, userRatingCount, reviews[]

Requires GOOGLE_PLACES_API_KEY in env. Each pair is roughly $0.04 — a full
1.9k-condo enrichment is ~$80; keep --limit conservative.

Reviews returned by the legacy /details endpoint are capped at 5 per place;
the v1 API exposes the same 5 (Google never gives you more without a paid
program). Useful for an LLM-style summary + sentiment, not exhaustive corpus.
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx
from loguru import logger

API_BASE = "https://places.googleapis.com/v1"

# Conservative — Places API New free tier is 6 QPS for text search.
DEFAULT_PER_REQUEST_DELAY_S = 0.3


def _api_key() -> str:
    k = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
    if not k:
        raise RuntimeError("GOOGLE_PLACES_API_KEY not set in env")
    return k


def search_text(
    client: httpx.Client,
    query: str,
    *,
    bias_lat: float | None = None,
    bias_lng: float | None = None,
    bias_radius_m: float = 5_000,
) -> dict[str, Any] | None:
    """Resolve `query` to the top matching place. Returns the first result dict
    or None if nothing matches.

    Field mask kept minimal to stay in the cheaper SKU tier.
    """
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": _api_key(),
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
    }
    body: dict[str, Any] = {"textQuery": query, "pageSize": 1}
    if bias_lat is not None and bias_lng is not None:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": bias_lat, "longitude": bias_lng},
                "radius": bias_radius_m,
            }
        }
    r = client.post(f"{API_BASE}/places:searchText", headers=headers, json=body)
    if r.status_code != 200:
        logger.warning(f"[reviews] searchText {r.status_code} for {query!r}: {r.text[:200]}")
        return None
    data = r.json()
    places = data.get("places") or []
    return places[0] if places else None


def get_place(
    client: httpx.Client,
    place_id: str,
) -> dict[str, Any] | None:
    """Fetch rating + reviews for a place_id."""
    headers = {
        "X-Goog-Api-Key": _api_key(),
        "X-Goog-FieldMask": (
            "id,displayName,rating,userRatingCount,"
            "reviews.rating,reviews.text,reviews.publishTime,"
            "reviews.authorAttribution.displayName"
        ),
    }
    r = client.get(f"{API_BASE}/places/{place_id}", headers=headers)
    if r.status_code != 200:
        logger.warning(f"[reviews] getPlace {r.status_code} for {place_id}: {r.text[:200]}")
        return None
    return r.json()


def enrich_condo(
    client: httpx.Client,
    name: str,
    *,
    lat: float | None = None,
    lng: float | None = None,
    city: str = "Bangkok",
    delay_s: float = DEFAULT_PER_REQUEST_DELAY_S,
) -> dict[str, Any] | None:
    """Resolve + enrich a single condo. Returns a dict with place_id, rating,
    review_count, and a list of up to 5 review dicts; or None if no match.

    delay_s is applied between the two HTTP calls.
    """
    query = f"{name} condo {city}" if city else f"{name} condo"
    hit = search_text(client, query, bias_lat=lat, bias_lng=lng)
    if not hit:
        return None
    pid = hit.get("id")
    if not pid:
        return None

    time.sleep(delay_s)
    full = get_place(client, pid)
    if not full:
        return {"place_id": pid, "rating": None, "review_count": 0, "reviews": []}

    out: dict[str, Any] = {
        "place_id": pid,
        "display_name": (full.get("displayName") or {}).get("text"),
        "rating": full.get("rating"),
        "review_count": full.get("userRatingCount") or 0,
        "reviews": [],
    }
    for r in full.get("reviews") or []:
        author = ((r.get("authorAttribution") or {}).get("displayName")) or None
        text = (r.get("text") or {}).get("text") or None
        out["reviews"].append({
            "rating": r.get("rating"),
            "text": text,
            "author": author,
            "published_at": r.get("publishTime"),
        })
    return out
