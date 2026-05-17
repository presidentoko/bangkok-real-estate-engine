"""FazWaz project (building) detail-page scraper — quota inventory only.

Each FazWaz project page lists its currently-for-sale units with a
`<span class="available-units-feature__col">` chip that says
"Thai Quota" / "Foreign Quota" (or nothing if the listing publisher
didn't tag it). Counting these per project gives:

  - foreign_quota_listings_available: # for-sale units tagged Foreign Quota
  - thai_quota_listings_available:    # for-sale units tagged Thai Quota
  - foreign_quota_inventory_pct:      foreign / (thai + foreign) × 100

High pct = lots of foreign-eligible units still on sale = easier for a
foreign buyer (good demand cushion).  Low pct = tight Foreign Quota,
buyer needs to act fast or settle for leasehold.

CF-blocked (same as the listing pages), so this uses the shared
`.nodriver-profile-fazwaz/` profile.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

from bs4 import BeautifulSoup
from loguru import logger

from src.scrapers.hipflat import _unwrap

PROFILE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".nodriver-profile-fazwaz",
)

GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 180
EVALUATE_TIMEOUT_S = 20


def parse_quota_stats(html: str) -> dict[str, Any]:
    """Count quota labels on a FazWaz project page. Returns:
      {
        foreign: int, thai: int, total: int,
        foreign_pct: float | None,
      }
    """
    soup = BeautifulSoup(html, "html.parser")
    # Each listing card on the project page has at most one
    # .available-units-feature div containing chips.
    feature_divs = soup.select("div.available-units-feature")
    total = len(feature_divs)
    foreign = 0
    thai = 0
    for div in feature_divs:
        chips = [s.get_text(strip=True) for s in div.select("span.available-units-feature__col")]
        if "Foreign Quota" in chips:
            foreign += 1
        elif "Thai Quota" in chips:
            thai += 1
    labeled = foreign + thai
    foreign_pct = round(100.0 * foreign / labeled, 1) if labeled > 0 else None
    return {
        "foreign": foreign,
        "thai": thai,
        "total": total,
        "labeled": labeled,
        "foreign_pct": foreign_pct,
    }


async def fetch_project_quota(browser, project_url: str) -> dict[str, Any] | None:
    """Fetch one FazWaz project page (must be a CF-cleared profile) and
    return the quota stats dict. None on failure."""
    try:
        tab = await asyncio.wait_for(browser.get(project_url), timeout=GOTO_TIMEOUT_S)
    except Exception as e:
        logger.warning(f"[fz-quota] goto failed: {e}")
        return None
    try:
        await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
    except asyncio.TimeoutError:
        logger.error("[fz-quota] CF not cleared in time")
        return None
    except Exception as e:
        logger.debug(f"[fz-quota] verify_cf: {e}")
    await asyncio.sleep(4.0)
    try:
        html = _unwrap(
            await asyncio.wait_for(
                tab.evaluate("document.documentElement.outerHTML"),
                timeout=EVALUATE_TIMEOUT_S,
            )
        )
    except Exception as e:
        logger.warning(f"[fz-quota] outerHTML failed: {e}")
        return None
    if not html:
        return None
    return parse_quota_stats(html)
