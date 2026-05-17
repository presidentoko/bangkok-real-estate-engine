"""Fetch one DDProperty page and save HTML + print card candidates for selector debugging."""
from __future__ import annotations
import asyncio, io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc
from bs4 import BeautifulSoup
from loguru import logger
from src.scrapers.hipflat import _unwrap

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile-ddproperty")
URL = "https://www.ddproperty.com/en/condo-for-sale/in-bangkok-th10"
OUT = os.path.join(ROOT, "dd_debug.html")

GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 180
EVALUATE_TIMEOUT_S = 20


async def main():
    browser = await uc.start(headless=False, user_data_dir=PROFILE_DIR, sandbox=True)
    try:
        tab = await asyncio.wait_for(browser.get(URL), timeout=GOTO_TIMEOUT_S)
        try:
            await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
        except Exception as e:
            logger.debug(f"verify_cf: {e}")
        await asyncio.sleep(5.0)
        html = _unwrap(await asyncio.wait_for(
            tab.evaluate("document.documentElement.outerHTML"), timeout=EVALUATE_TIMEOUT_S
        ))
    finally:
        browser.stop()

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    logger.info(f"Saved {len(html):,} chars to {OUT}")

    soup = BeautifulSoup(html, "html.parser")

    # Try all plausible selectors and report counts
    selectors = [
        "[data-listing-id]",
        "div.listing-card-root",
        "[da-id*='listing-card']",
        "div[class*='listing-card']",
        "div[class*='ListingCard']",
        "article",
        "div[class*='property-card']",
        "div[class*='PropertyCard']",
        "div[data-cy*='listing']",
        "div[data-testid*='listing']",
        "a[href*='/property/']",
        "a[href*='/condo/']",
    ]
    print("\n=== Selector hits ===")
    for sel in selectors:
        hits = soup.select(sel)
        print(f"  {len(hits):4d}  {sel}")

    # Show first 3 div classes that appear many times
    from collections import Counter
    div_classes = Counter()
    for tag in soup.find_all("div", class_=True):
        for c in tag.get("class", []):
            div_classes[c] += 1
    print("\n=== Top 20 div classes ===")
    for cls, count in div_classes.most_common(20):
        print(f"  {count:4d}  {cls}")


if __name__ == "__main__":
    asyncio.run(main())
