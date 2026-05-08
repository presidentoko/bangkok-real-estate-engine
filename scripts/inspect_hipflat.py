"""Inspect hipflat.co.th card structure (separate from ddproperty so we don't
spam either site repeatedly)."""
from __future__ import annotations

import asyncio
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.scrapers.base import (  # noqa: E402
    human_pause, human_scroll, new_stealth_page, stealth_context,
)

JS = """
() => {
  // Cards likely contain an h2/h3 title and a price-bearing leaf.
  const links = document.querySelectorAll("a[href*='/condo/']");
  const seen = new Set();
  const out = [];
  for (const a of Array.from(links).slice(0, 40)) {
    const href = a.getAttribute("href");
    if (!href || seen.has(href)) continue;
    seen.add(href);
    // Climb up to find card-ish ancestor with price text
    let card = a;
    for (let i = 0; i < 8; i++) {
      if (!card.parentElement) break;
      card = card.parentElement;
      const text = card.textContent || "";
      if (/(฿|THB|baht|million)/i.test(text) && /(sq\\.?m|m²)/i.test(text) && text.length < 1500) break;
    }
    if (out.length >= 3) break;
    out.push({
      href,
      tag: card.tagName,
      cls: card.className?.toString?.() || "",
      text_len: (card.textContent || "").length,
      text: (card.textContent || "").trim().slice(0, 600),
      outer: card.outerHTML.slice(0, 3500),
    });
  }
  return out;
}
"""


async def main() -> None:
    url = "https://www.hipflat.co.th/en/thailand-projects/condo/bangkok-bm/watthana-wa"
    print(f"Inspecting: {url}\n")
    async with stealth_context() as (_, ctx):
        page = await new_stealth_page(ctx)
        try:
            r = await page.goto(url, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"goto failed: {e}")
            return
        print(f"status={r.status if r else '?'}")
        await human_pause(5, 9)
        try:
            await human_scroll(page)
        except Exception:
            pass
        cards = await page.evaluate(JS)
        print(f"found {len(cards)} cards\n")
        for i, c in enumerate(cards):
            print(f"\n{'=' * 70}\nCARD {i}: <{c['tag']}> class='{c['cls'][:60]}'")
            print(f"href: {c['href']}")
            print(f"text_len: {c['text_len']}")
            print(f"TEXT: {c['text']}")
            print(f"\nOUTER (first 1500 chars):")
            print(c["outer"][:1500])


if __name__ == "__main__":
    asyncio.run(main())
