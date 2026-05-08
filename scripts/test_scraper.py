"""Quick smoke test: pull N listings from ddproperty and print to console.
No DB writes. Verifies selectors before committing to a full pipeline run.
"""
from __future__ import annotations

import asyncio
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.scrapers import ddproperty  # noqa: E402


async def main() -> None:
    cap = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    print(f"Pulling up to {cap} ddproperty listings…\n")
    n = 0
    async for item in ddproperty.scrape(cap):
        n += 1
        print(f"--- listing {n} ---")
        print(f"  id   : {item.get('source_listing_id')}")
        print(f"  name : {item.get('name')}")
        print(f"  price: {item.get('price'):>12,.0f} THB"
              if item.get("price") else "  price: —")
        print(f"  area : {item.get('area_sqm')} m²" if item.get("area_sqm") else "  area : —")
        print(f"  url  : {item.get('url')}")
    print(f"\n✅ got {n} listings")


if __name__ == "__main__":
    asyncio.run(main())
