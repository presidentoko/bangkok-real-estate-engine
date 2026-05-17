"""Fetch one FazWaz project detail page + scan for foreign-quota signals.

Saves the rendered HTML to fz_project_debug.html and prints any text
containing 'quota', 'foreign', 'thai', 'available', or percentage signs.
"""
from __future__ import annotations
import asyncio, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc
from bs4 import BeautifulSoup
from loguru import logger
from src.scrapers.hipflat import _unwrap

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile-fazwaz")
URL = "https://www.fazwaz.com/projects/thailand/bangkok/watthana/khlong-toei-nuea/hyde-sukhumvit-11"
OUT = os.path.join(ROOT, "fz_project_debug.html")

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

    # Look for any text mentioning quota / foreign / thai
    print("\n=== Quota-related text snippets ===")
    keywords = ["quota", "foreign", "thai", "freehold", "leasehold", "ownership", "%"]
    seen = set()
    for el in soup.find_all(text=True):
        s = str(el).strip()
        if not s or len(s) < 4:
            continue
        low = s.lower()
        if any(k in low for k in keywords):
            if s in seen or len(s) > 400:
                continue
            seen.add(s)
            parent = el.parent.name if el.parent else "?"
            cls = " ".join(el.parent.get("class", [])) if el.parent else ""
            print(f"  [{parent}.{cls[:30]}] {s[:200]!r}")
            if len(seen) > 30:
                break

    # Specific selectors to check
    print("\n=== Candidate ownership/quota blocks ===")
    for sel in [
        "[class*='quota']", "[class*='ownership']", "[class*='foreign']",
        "[class*='facts']", "[class*='facility']", "[class*='spec']",
        ".project-info", ".project-details", ".building-detail",
        "[class*='Facts']", "[class*='Detail']",
    ]:
        hits = soup.select(sel)
        if hits:
            print(f"  {sel}: {len(hits)}")
            for h in hits[:2]:
                txt = h.get_text(" | ", strip=True)[:300]
                if txt:
                    print(f"    {txt}")

    # Detect any number-of-units / inventory style table
    print("\n=== Tables / dl pairs ===")
    for tbl in soup.select("table, dl"):
        txt = tbl.get_text(" | ", strip=True)[:400]
        if txt and any(k in txt.lower() for k in keywords + ["unit", "available"]):
            print(f"  [{tbl.name}] {txt}")


if __name__ == "__main__":
    asyncio.run(main())
