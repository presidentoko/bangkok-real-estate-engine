"""Probe FazWaz + DDProperty detail pages to locate lat/lng in HTML.

Dumps rendered HTML for one sample listing per source, then scans for
common geo patterns (latitude / longitude / lat=,lng= / google.com/maps).
Run output tells us which DOM/JS path to wire into the scrapers.

Usage:
  python scripts/probe_latlng_detail.py
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

SAMPLES = [
    {
        "source": "fazwaz",
        "profile": ".nodriver-profile-fazwaz",
        "url": "https://www.fazwaz.com/property-sales/1-bedroom-condo-for-sale-at-cozi-bts-saphanmai-in-khlong-thanon-bangkok-u5849375",
        "out": "fz_detail_probe.html",
    },
    {
        "source": "ddproperty",
        "profile": ".nodriver-profile-ddproperty",
        "url": "https://www.ddproperty.com/en/property/sindhorn-residence-for-sale-500318245",
        "out": "dd_detail_probe.html",
    },
]

PATTERNS = [
    ("latitude_field", re.compile(r'"latitude"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("longitude_field", re.compile(r'"longitude"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("lat_field", re.compile(r'"lat"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("lng_field", re.compile(r'"lng"\s*:\s*(-?\d+\.\d+)', re.IGNORECASE)),
    ("data-lat-attr", re.compile(r'data-lat(?:itude)?\s*=\s*"(-?\d+\.\d+)"', re.IGNORECASE)),
    ("data-lng-attr", re.compile(r'data-lng?(?:itude)?\s*=\s*"(-?\d+\.\d+)"', re.IGNORECASE)),
    ("google_maps_url", re.compile(r'google\.com/maps[^"\'\s]*?[?&](?:q|ll)=(-?\d+\.\d+,-?\d+\.\d+)', re.IGNORECASE)),
    ("staticmap", re.compile(r'staticmap[^"\'\s]*?center=(-?\d+\.\d+,-?\d+\.\d+)', re.IGNORECASE)),
    ("iframe_src_q", re.compile(r'maps[^"\'\s]*?[?&]q=(-?\d+\.\d+,-?\d+\.\d+)', re.IGNORECASE)),
    ("any_thai_coord", re.compile(r'(1[2-4]\.\d{4,}),\s*(10[0-1]\.\d{4,})')),
]

GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 180
EVALUATE_TIMEOUT_S = 20


async def fetch(sample: dict) -> str:
    profile = os.path.join(ROOT, sample["profile"])
    os.makedirs(profile, exist_ok=True)
    browser = await uc.start(headless=False, user_data_dir=profile, sandbox=True)
    try:
        tab = await asyncio.wait_for(browser.get(sample["url"]), timeout=GOTO_TIMEOUT_S)
        try:
            await asyncio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
        except Exception as e:
            logger.debug(f"verify_cf: {e}")
        await asyncio.sleep(8.0)
        html = _unwrap(await asyncio.wait_for(
            tab.evaluate("document.documentElement.outerHTML"),
            timeout=EVALUATE_TIMEOUT_S,
        ))
    finally:
        browser.stop()
    return html


def scan(html: str) -> dict[str, list[str]]:
    hits = {}
    for name, pat in PATTERNS:
        matches = pat.findall(html)
        if matches:
            hits[name] = matches[:5]
    return hits


async def main():
    for sample in SAMPLES:
        print(f"\n=== {sample['source']}: {sample['url']} ===", flush=True)
        try:
            html = await fetch(sample)
        except Exception as e:
            print(f"  FETCH ERR: {type(e).__name__}: {e}", flush=True)
            continue
        out_path = os.path.join(ROOT, sample["out"])
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  saved {len(html):,} chars to {sample['out']}", flush=True)
        hits = scan(html)
        if not hits:
            print("  NO lat/lng patterns matched", flush=True)
        else:
            for name, vals in hits.items():
                print(f"  HIT {name}: {vals}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
