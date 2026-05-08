"""Extract real listing/search URL patterns from ddproperty + hipflat homepages.

Tells us:
  - What URL slugs ddproperty/hipflat actually use for region searches
  - Where individual condo detail pages live
"""
from __future__ import annotations

import asyncio
import io
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.scrapers.base import (  # noqa: E402
    human_pause, human_scroll, new_stealth_page, stealth_context,
)


async def extract(label: str, url: str, base: str) -> None:
    print(f"\n=== {label} ({url}) ===")
    async with stealth_context() as (_, ctx):
        page = await new_stealth_page(ctx)
        try:
            r = await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"  goto failed: {e}")
            return
        print(f"  status: {r.status if r else '?'}")
        await human_pause(3, 6)
        try:
            await human_scroll(page)
        except Exception:
            pass

        anchors = await page.eval_on_selector_all(
            "a[href]",
            "els => els.map(e => e.getAttribute('href'))",
        )
        print(f"  total <a href>: {len(anchors)}")

        # Bucket by URL prefix shape
        buckets: dict[str, Counter] = {}
        examples: dict[str, list[str]] = {}
        for href in anchors:
            if not href or href.startswith("#") or href.startswith("javascript:"):
                continue
            # Normalise to relative path on same host
            path = href
            if href.startswith("http"):
                if base in href:
                    path = href[len(base.split("://", 1)[1].split("/", 1)[0]) + len(base.split("://")[0]) + 3:]
                else:
                    continue
            # Bucket by first 2 path segments
            segs = [s for s in path.split("/") if s][:2]
            key = "/" + "/".join(segs) if segs else "/"
            buckets.setdefault(key, Counter()).update([path])
            examples.setdefault(key, [])
            if len(examples[key]) < 3:
                examples[key].append(path)

        # Print buckets that look like search/listing pages
        keywords = ("condo", "property", "rent", "sale", "sukhumvit", "ari",
                    "rama", "bangkok", "search", "listing", "phra-ram")
        printed = 0
        for key in sorted(buckets, key=lambda k: -sum(buckets[k].values())):
            if not any(kw in key.lower() for kw in keywords):
                continue
            count = sum(buckets[key].values())
            print(f"  {key}  ({count} links)")
            for ex in examples[key][:3]:
                print(f"     → {ex}")
            printed += 1
            if printed >= 12:
                break
        if printed == 0:
            print("  (no obviously listing-related buckets found — printing top 8 raw)")
            for key in sorted(buckets, key=lambda k: -sum(buckets[k].values()))[:8]:
                print(f"  {key} ({sum(buckets[key].values())} links)")
                for ex in examples[key][:2]:
                    print(f"     → {ex}")


async def main() -> None:
    # English homepage gets us en URLs that map to our scraper config.
    await extract("ddproperty /en/", "https://www.ddproperty.com/en", "https://www.ddproperty.com")
    await extract("hipflat /en/", "https://www.hipflat.co.th/en", "https://www.hipflat.co.th")


if __name__ == "__main__":
    asyncio.run(main())
