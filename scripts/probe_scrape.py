"""Diagnose why scrapers find 0 listings.

For each target source/region:
  1. Open the URL with our stealth stack
  2. Save a screenshot AND the page title + element counts
  3. Save first 3 KB of HTML so we can spot Cloudflare challenges

Outputs go to scripts/probes/.

Usage:
    python scripts/probe_scrape.py
"""
from __future__ import annotations

import asyncio
import io
import os
import sys

# Force UTF-8 stdout so ASCII markers below print on Windows cp1252.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.scrapers.base import (  # noqa: E402
    human_pause, human_scroll, new_stealth_page, stealth_context,
)
from src.scrapers import ddproperty, hipflat  # noqa: E402

OUT_DIR = os.path.join(ROOT, "scripts", "probes")
os.makedirs(OUT_DIR, exist_ok=True)

# Common selectors a real listings page would have.
PROBE_SELECTORS = [
    "[class*='listing']",
    "[class*='card']",
    "[data-testid]",
    "[data-automation-id]",
    "article",
    "h2", "h3",
    "img",
    "a[href*='/listing']",
    "a[href*='/property']",
    "a[href*='/condo']",
]

# Words/markers that indicate Cloudflare or anti-bot challenge.
CHALLENGE_MARKERS = [
    "cf-browser-verification",
    "Just a moment",
    "Checking your browser",
    "challenge-platform",
    "captcha",
    "Access denied",
    "blocked",
    "/cdn-cgi/challenge-platform",
]


async def probe(label: str, url: str) -> None:
    print(f"\n=== {label} ===")
    print(f"URL: {url}")
    async with stealth_context() as (_, ctx):
        page = await new_stealth_page(ctx)
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"  ❌ goto failed: {e}")
            return

        if response is None:
            print("  ❌ no HTTP response")
            return
        print(f"  HTTP status: {response.status}")
        print(f"  Final URL  : {response.url}")

        await human_pause(3, 6)
        try:
            await human_scroll(page)
        except Exception:
            pass

        title = await page.title()
        html = await page.content()
        print(f"  Title: {title}")
        print(f"  HTML length: {len(html):,}")

        markers_hit = [m for m in CHALLENGE_MARKERS if m.lower() in html.lower()]
        if markers_hit:
            print(f"  [BLOCK] Anti-bot markers detected: {markers_hit}")
        else:
            print(f"  ✅ No obvious anti-bot markers")

        print(f"  Selector counts:")
        for sel in PROBE_SELECTORS:
            try:
                count = len(await page.query_selector_all(sel))
            except Exception:
                count = -1
            print(f"     {sel:35s} → {count}")

        # Save screenshot
        png_path = os.path.join(OUT_DIR, f"{label}.png")
        try:
            await page.screenshot(path=png_path, full_page=True)
            print(f"  [png] screenshot: {png_path}")
        except Exception as e:
            print(f"  ⚠️ screenshot failed: {e}")

        # Save HTML excerpt
        html_path = os.path.join(OUT_DIR, f"{label}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html[:250000])
        print(f"  [html] html: {html_path}")


async def main() -> None:
    # Try the URL patterns we discovered from extract_urls.py.
    targets = [
        ("hipflat-project-paragon-31",
         "https://www.hipflat.co.th/en/projects/paragon-31-ukvsxa"),
    ]
    for label, url in targets:
        await probe(label, url)
    print("\nDone. Open scripts/probes/*.png to see what loaded.")


if __name__ == "__main__":
    asyncio.run(main())
