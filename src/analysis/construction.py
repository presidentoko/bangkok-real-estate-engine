"""District-level construction activity signal via Google News RSS.

Why this approach:
  - News-headline frequency is a robust proxy for "how much new construction
    is happening in district X right now" — developers announce, contractors
    file, local press covers.
  - Google News RSS is publicly served, no API key, no JS execution required,
    no scraper-detection arms race.
  - We aggregate at district level (not per-condo) and cache in-process so a
    full pipeline run hits Google News at most ~3–10 times.

Buckets (tunable, see KEYWORDS / thresholds below):
  Low     : <  3 hits
  Medium  : 3–9 hits
  High    : ≥ 10 hits
"""
from __future__ import annotations

from urllib.parse import quote_plus

import feedparser
from loguru import logger

NEWS_RSS_TEMPLATE = (
    "https://news.google.com/rss/search?q={q}&hl=en-TH&gl=TH&ceid=TH:en"
)

KEYWORDS: tuple[str, ...] = (
    '"under construction"',
    '"new project"',
    '"new launch"',
    '"off-plan"',
    '"groundbreaking"',
)


def _fetch_count(district: str, keyword: str) -> int:
    q = f'{keyword} "{district}" Bangkok condo'
    url = NEWS_RSS_TEMPLATE.format(q=quote_plus(q))
    try:
        feed = feedparser.parse(url)
        return len(feed.entries)
    except Exception as e:
        logger.warning(f"construction RSS failed for {district}/{keyword}: {e}")
        return 0


def district_construction_signal(district: str) -> tuple[str, int]:
    """Return (bucket, total_hits) where bucket ∈ {'low','medium','high'}."""
    total = sum(_fetch_count(district, kw) for kw in KEYWORDS)
    if total >= 10:
        bucket = "high"
    elif total >= 3:
        bucket = "medium"
    else:
        bucket = "low"
    logger.debug(f"construction[{district}]: hits={total} → {bucket}")
    return bucket, total
