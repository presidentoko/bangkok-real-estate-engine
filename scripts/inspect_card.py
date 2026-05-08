"""Print every visible-text leaf inside one listing card so we can map fields."""
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

JS_DUMP_LEAVES = """
(rootSel) => {
  const cards = document.querySelectorAll(rootSel);
  const out = [];
  // Inspect first 3 cards to see typical structure.
  for (const card of Array.from(cards).slice(0, 3)) {
    const id = card.getAttribute("data-listing-id");
    const items = [];
    // Walk DOM, capture leaf elements (no children) with non-empty text.
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.children.length > 0) continue;
      const t = (n.textContent || "").trim();
      if (!t) continue;
      const cls = n.className && typeof n.className === "string"
                  ? n.className : "";
      items.push({
        tag: n.tagName,
        cls: cls,
        daId: n.getAttribute("da-id") || "",
        text: t.slice(0, 120),
      });
    }
    out.push({ listing_id: id, leaves: items });
  }
  return out;
}
"""


async def main() -> None:
    url = "https://www.ddproperty.com/en/condo-for-sale/in-bangkok-th10"
    print(f"Inspecting cards on: {url}\n")
    async with stealth_context() as (_, ctx):
        page = await new_stealth_page(ctx)
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await human_pause(3, 6)
        try:
            await human_scroll(page)
        except Exception:
            pass

        cards = await page.evaluate(JS_DUMP_LEAVES, "div.listing-card-root")
        print(f"Inspected {len(cards)} cards\n")
        for i, c in enumerate(cards):
            print(f"\n{'=' * 70}")
            print(f"CARD {i}: data-listing-id={c['listing_id']}")
            print(f"{'=' * 70}")
            for leaf in c["leaves"]:
                cls = leaf["cls"][:40]
                da = leaf["daId"][:30]
                tag = leaf["tag"]
                print(f"  <{tag:6s}> da='{da:30s}' cls='{cls:40s}' :: {leaf['text']}")


if __name__ == "__main__":
    asyncio.run(main())
