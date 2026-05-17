"""Open FazWaz Bangkok listings via nodriver (CF-resistant), save HTML + scan selectors.

Mirrors scripts/debug_ddproperty_html.py. First run: browser opens, may need
manual Turnstile click; subsequent runs reuse cookies from the persistent
profile. Output:
  fz_debug.html        — raw rendered HTML
  stdout summary       — selector hit counts + top div classes + __NEXT_DATA__ presence
"""
from __future__ import annotations
import asyncio, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc
from bs4 import BeautifulSoup
from loguru import logger

from src.scrapers.hipflat import _unwrap

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile-fazwaz")
URL = "https://www.fazwaz.com/property-for-sale/thailand/bangkok"
OUT = os.path.join(ROOT, "fz_debug.html")

GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 180
EVALUATE_TIMEOUT_S = 20


async def main():
    os.makedirs(PROFILE_DIR, exist_ok=True)
    browser = await uc.start(headless=False, user_data_dir=PROFILE_DIR, sandbox=True)
    try:
        tab = await asyncio.wait_for(browser.get(URL), timeout=GOTO_TIMEOUT_S)
        try:
            await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
        except Exception as e:
            logger.debug(f"verify_cf: {e}")
        await asyncio.sleep(6.0)
        html = _unwrap(await asyncio.wait_for(
            tab.evaluate("document.documentElement.outerHTML"),
            timeout=EVALUATE_TIMEOUT_S,
        ))
    finally:
        browser.stop()

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    logger.info(f"Saved {len(html):,} chars to {OUT}")

    soup = BeautifulSoup(html, "html.parser")

    selectors = [
        "article", "[data-testid*='card']", "[data-testid*='listing']",
        "[data-testid*='property']", "[class*='property-card']",
        "[class*='PropertyCard']", "[class*='listing-card']",
        "[class*='ListingCard']", "a[href*='/property/']",
        "a[href*='/listing/']", "[itemtype*='RealEstateListing']",
        "[class*='card-property']", "[class*='card-listing']",
    ]
    print("\n=== Selector hits ===")
    for sel in selectors:
        hits = soup.select(sel)
        if hits:
            print(f"  {len(hits):4d}  {sel}")

    from collections import Counter
    div_classes = Counter()
    for tag in soup.find_all("div", class_=True):
        for c in tag.get("class", []):
            div_classes[c] += 1
    print("\n=== Top 25 div classes ===")
    for cls, count in div_classes.most_common(25):
        print(f"  {count:4d}  {cls}")

    # __NEXT_DATA__ — Next.js sites embed initial state here
    nd = soup.find("script", id="__NEXT_DATA__")
    if nd and nd.string:
        try:
            data = json.loads(nd.string)
            print("\n=== __NEXT_DATA__ found ===")
            # Walk keys to identify where listings live
            def _summarize(obj, prefix="", depth=0, max_depth=6):
                if depth > max_depth:
                    return
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        if isinstance(v, list) and v and isinstance(v[0], dict):
                            keys = sorted(set().union(*[r.keys() for r in v[:3] if isinstance(r, dict)]))
                            if any(re.search(r"price|listing|propert|condo|bedroom", k, re.I) for k in keys):
                                print(f"  {prefix}{k}  → list[{len(v)}]  keys={keys[:12]}")
                        elif isinstance(v, (dict, list)):
                            _summarize(v, prefix + k + ".", depth + 1, max_depth)
                elif isinstance(obj, list) and obj and isinstance(obj[0], dict):
                    _summarize(obj[0], prefix + "[0].", depth + 1, max_depth)
            _summarize(data)
        except Exception as e:
            print(f"  __NEXT_DATA__ parse failed: {e}")
    else:
        print("\n  No __NEXT_DATA__ script tag.")


if __name__ == "__main__":
    asyncio.run(main())
