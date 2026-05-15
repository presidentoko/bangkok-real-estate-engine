"""Quick test: can we get past Cloudflare on ddproperty.com?

Launches a visible Chrome window with the persistent profile.
If CF challenge appears, solve it manually — cookies will be saved.
Once past, prints the page title and first few listing card counts.

Usage:
  python scripts/test_ddproperty_cf.py
"""
from __future__ import annotations

import asyncio
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger
from src.scrapers.base import persistent_context, wait_past_challenge
from src.scrapers.ddproperty import SEARCH_URL, CARD_SELECTORS, _parse_cards

PROFILE = os.path.join(os.getcwd(), ".playwright-profile-ddproperty")


async def main() -> None:
    logger.info(f"Launching Chrome with profile: {PROFILE}")
    logger.info(f"Target: {SEARCH_URL}")
    async with persistent_context(profile_dir=PROFILE) as ctx:
        page = await ctx.new_page()
        await page.goto(SEARCH_URL, wait_until="domcontentloaded", timeout=45000)

        title = await page.title()
        logger.info(f"Page title: {title!r}")

        passed = await wait_past_challenge(page, max_wait_s=300)
        if not passed:
            logger.error("CF challenge not cleared — aborting")
            return

        title = await page.title()
        logger.info(f"Post-challenge title: {title!r}")

        await asyncio.sleep(2)
        cards = await _parse_cards(page)
        logger.info(f"Cards parsed: {len(cards)}")
        for c in cards[:5]:
            logger.info(f"  {c['name']!r} | {c['price']:,.0f} THB | {c['url']}")


if __name__ == "__main__":
    asyncio.run(main())
