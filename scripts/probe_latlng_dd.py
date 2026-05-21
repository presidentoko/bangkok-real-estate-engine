"""DDProperty-only lat/lng probe (after killing chrome-headless-shell zombies).

Fetches one detail page, dumps to dd_detail_probe.html, scans for geo patterns.
"""
from __future__ import annotations
import asyncio
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc
from loguru import logger
from src.scrapers.hipflat import _unwrap

URL = "https://www.ddproperty.com/en/property/the-view-cozy-beach-residence-for-sale-500240252"
OUT = os.path.join(ROOT, "dd_detail_probe.html")
PROFILE = os.path.join(ROOT, ".nodriver-profile-ddproperty")

PATTERNS = [
    ("latitude_field", re.compile(r'"latitude"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("longitude_field", re.compile(r'"longitude"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("lat_field", re.compile(r'"lat"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("lng_field", re.compile(r'"lng"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("data-lat", re.compile(r'data-lat(?:itude)?\s*=\s*"(-?\d+\.\d+)"', re.IGNORECASE)),
    ("data-lng", re.compile(r'data-lng?(?:itude)?\s*=\s*"(-?\d+\.\d+)"', re.IGNORECASE)),
    ("google_maps_ll", re.compile(r'google\.com/maps[^"\'\s]*?[?&](?:q|ll|center|viewpoint)=(-?\d+\.\d+,-?\d+\.\d+)', re.IGNORECASE)),
    ("staticmap_center", re.compile(r'staticmap[^"\'\s]*?center=(-?\d+\.\d+,-?\d+\.\d+)', re.IGNORECASE)),
    ("any_thai_coord", re.compile(r'(1[2-4]\.\d{4,}),\s*(10[0-1]\.\d{4,})')),
]


async def main():
    os.makedirs(PROFILE, exist_ok=True)
    browser = await uc.start(headless=False, user_data_dir=PROFILE, sandbox=True)
    try:
        tab = await asyncio.wait_for(browser.get(URL), timeout=60)
        try:
            await asyncio.wait_for(tab.verify_cf(), timeout=180)
        except Exception as e:
            logger.debug(f"verify_cf: {e}")
        await asyncio.sleep(10.0)
        html = _unwrap(await asyncio.wait_for(
            tab.evaluate("document.documentElement.outerHTML"),
            timeout=20,
        ))
    finally:
        browser.stop()

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"saved {len(html):,} chars to {OUT}", flush=True)

    hits = {}
    for name, pat in PATTERNS:
        matches = pat.findall(html)
        if matches:
            hits[name] = matches[:5]
    if not hits:
        print("NO lat/lng patterns matched", flush=True)
    else:
        for name, vals in hits.items():
            print(f"HIT {name}: {vals}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
