"""Find the right CSS selectors by inspecting real listing-card HTML.

Strategy:
  - Open each search URL
  - Get all candidate "card-ish" elements
  - Filter to elements that contain BOTH a price-like text AND a link
  - Dump first 2 of those (outerHTML) to a file so we can see real classnames
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

from src.scrapers.base import (  # noqa: E402
    human_pause, human_scroll, new_stealth_page, stealth_context,
)

OUT_DIR = os.path.join(ROOT, "scripts", "probes")
os.makedirs(OUT_DIR, exist_ok=True)

JS_FIND_CARDS = """
(_) => {
  const candidates = document.querySelectorAll(
    "[class*='listing'], [class*='card'], [class*='Card'], [class*='Listing'], article, li"
  );
  const out = [];
  const priceRe = /(฿|THB|baht|million|\\bM\\b|\\bK\\b)/i;
  for (const el of candidates) {
    const text = el.textContent || "";
    const hasPrice = priceRe.test(text);
    const hasLink = !!el.querySelector("a[href]");
    const hasArea = /(sq\\.?m|m²|sqm)/i.test(text);
    if (hasPrice && hasLink && hasArea && text.length < 2000) {
      out.push({
        tag: el.tagName,
        cls: el.className,
        outerHTML: el.outerHTML.slice(0, 4000),
      });
    }
    if (out.length >= 4) break;
  }
  return out;
}
"""


async def discover(label: str, url: str) -> None:
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

        cards = await page.evaluate(JS_FIND_CARDS, None)
        print(f"  candidate cards (price + link + area): {len(cards)}")

        path = os.path.join(OUT_DIR, f"{label}-cards.html")
        with open(path, "w", encoding="utf-8") as f:
            for i, c in enumerate(cards):
                f.write(f"<!-- CARD {i}: <{c['tag']}> class={c['cls']!r} -->\n")
                f.write(c["outerHTML"])
                f.write("\n\n" + "=" * 80 + "\n\n")
        print(f"  wrote → {path}")
        for c in cards:
            print(f"    <{c['tag']}> class='{c['cls'][:80]}'")


async def main() -> None:
    targets = [
        ("ddproperty",
         "https://www.ddproperty.com/en/condo-for-sale/in-bangkok-th10"),
        ("hipflat",
         "https://www.hipflat.co.th/en/condo-for-sale/bangkok"),
    ]
    for label, url in targets:
        await discover(label, url)


if __name__ == "__main__":
    asyncio.run(main())
