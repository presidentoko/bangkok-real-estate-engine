"""Discover hipflat province → region_root slugs from the master condo
directory. Prints all province slugs so we can confirm Pattaya/Hua Hin
without guessing.

Usage:
    python scripts/probe_region_root.py
"""
from __future__ import annotations

import asyncio
import io
import os
import sys
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

from src.scrapers.hipflat import _unwrap  # noqa: E402

PROFILE_DIR = os.path.join(ROOT, ".nodriver-profile")
MASTER_DIRS = [
    "https://www.hipflat.co.th/en/thailand-projects/condo",
    "https://www.hipflat.co.th/en/thailand-projects/apartment",
]

# Keywords that suggest the province we care about (case-insensitive substring).
TARGETS = {
    "pattaya": ["pattaya", "chonburi", "chon-buri", "chon buri"],
    "huahin":  ["hua hin", "hua-hin", "huahin", "prachuap"],
    "bangkok": ["bangkok"],
}


def _classify(slug: str, title: str) -> str | None:
    blob = f"{slug} {title}".lower()
    for label, kws in TARGETS.items():
        if any(kw in blob for kw in kws):
            return label
    return None


async def main() -> None:
    os.makedirs(PROFILE_DIR, exist_ok=True)
    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_DIR,
        browser_args=["--lang=en-US"],
    )
    try:
        for master_url in MASTER_DIRS:
            ptype = urlparse(master_url).path.rsplit("/", 1)[-1]
            logger.info(f"--- master dir: {master_url} ({ptype}) ---")
            tab = await browser.get(master_url)
            try:
                await tab.verify_cf()
            except Exception as e:
                logger.warning(f"verify_cf raised (continuing): {e}")
            await tab.sleep(3)

            prefix = f"/en/thailand-projects/{ptype}/"
            js = f"""
            (() => {{
              const out = [];
              const seen = new Set();
              for (const a of document.querySelectorAll('a[href]')) {{
                const href = a.getAttribute('href');
                if (!href || !href.includes({prefix!r})) continue;
                if (seen.has(href)) continue;
                seen.add(href);
                out.push([href, a.getAttribute('title') || a.textContent.trim().slice(0,60)]);
              }}
              return out;
            }})()
            """
            raw = _unwrap(await tab.evaluate(js)) or []

            # Keep only one-segment slugs (province directories), drop deeper paths.
            provinces: list[tuple[str, str, str]] = []
            seen_slug: set[str] = set()
            for href, title in raw:
                path = urlparse(href).path
                if prefix not in path:
                    continue
                tail = path.split(prefix, 1)[1].rstrip("/")
                if not tail or "/" in tail:
                    continue
                if tail in seen_slug:
                    continue
                seen_slug.add(tail)
                provinces.append((tail, title or "", _classify(tail, title or "") or ""))

            if not provinces:
                title = _unwrap(await tab.evaluate("document.title"))
                logger.warning(f"no province slugs found — page title={title!r}")
                continue

            logger.info(f"{len(provinces)} province slugs found:")
            # Print everything; flag matches with arrow.
            for slug, title, match in sorted(provinces):
                marker = f" → {match.upper()}" if match else ""
                logger.info(f"  {slug:40s}  {title[:50]:50s}{marker}")

            await tab.sleep(2)
    finally:
        try:
            browser.stop()
        except Exception:
            pass


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
