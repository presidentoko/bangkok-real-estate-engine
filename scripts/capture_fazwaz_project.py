"""One-off: open a FazWaz PROJECT page in the warm CF profile, save its HTML,
and surface any element mentioning "Developer" so we can find the selector to
extract the developer name in fazwaz_project.py.

A Chrome window opens (headed). If a Cloudflare "just a moment" page shows,
solve it once in the window — the script waits up to 180s.

Usage:
  python scripts/capture_fazwaz_project.py
  python scripts/capture_fazwaz_project.py <project_url>
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from bs4 import BeautifulSoup  # noqa: E402
from loguru import logger  # noqa: E402

from src.scrapers.base import persistent_context, wait_past_challenge  # noqa: E402

FAZWAZ_PROFILE = str(ROOT / ".nodriver-profile-fazwaz")
DEFAULT_URL = "https://www.fazwaz.com/projects/thailand/bangkok/bang-na/bang-na/the-coast-bangkok"
OUT_HTML = ROOT / "debug_html" / "fazwaz_project_sample.html"


async def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    logger.info(f"opening {url}")
    async with persistent_context(FAZWAZ_PROFILE) as ctx:
        page = await ctx.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        ok = await wait_past_challenge(page, max_wait_s=180)
        if not ok:
            logger.error("challenge not cleared — aborting")
            return 1
        await asyncio.sleep(4.0)
        html = await page.content()

    OUT_HTML.parent.mkdir(exist_ok=True)
    OUT_HTML.write_text(html, encoding="utf-8")
    logger.info(f"saved {len(html)} bytes -> {OUT_HTML}")

    # Surface any element whose text mentions "developer" (en) — print tag/class
    # + nearby text so we can pick a stable selector.
    soup = BeautifulSoup(html, "html.parser")
    hits = 0
    for el in soup.find_all(string=lambda s: s and "developer" in s.lower()):
        parent = el.parent
        gp = parent.parent if parent else None
        print("---- developer text hit ----")
        print("  text   :", " ".join(el.split())[:120])
        if parent is not None:
            print("  parent :", parent.name, "class=", parent.get("class"))
            print("  parent text:", " ".join(parent.get_text(" ", strip=True).split())[:160])
        if gp is not None:
            print("  grandp :", gp.name, "class=", gp.get("class"))
            print("  grandp text:", " ".join(gp.get_text(" ", strip=True).split())[:200])
        hits += 1
        if hits >= 8:
            break
    if hits == 0:
        print("NO 'developer' text found. Searching common label patterns...")
        for label in ("Project Owner", "Developed by", "Brand", "Year Built", "Completion"):
            for el in soup.find_all(string=lambda s, l=label: s and l.lower() in s.lower()):
                p = el.parent
                print(f"  [{label}] ->", p.name, p.get("class"),
                      "|", " ".join(p.get_text(' ', strip=True).split())[:140])
                break
    print(f"\n=== {hits} developer hits ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
