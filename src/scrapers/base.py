"""Stealth Playwright base.

Notes:
  - playwright-stealth + randomised UA + jittered delays + human-like scroll/mouse.
  - These reduce false-positive bot detection on legitimately accessible pages;
    they are NOT a CAPTCHA solver and should not be used to evade explicit blocks.
  - Always check robots.txt and ToS before pointing this at a target.
"""
from __future__ import annotations

import asyncio
import os
import random
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fake_useragent import UserAgent
from loguru import logger
from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from playwright_stealth import stealth_async

from src.config import get_settings


VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1920, "height": 1080},
]
LOCALES = ["en-US", "en-GB", "th-TH"]


async def human_pause(min_s: float | None = None, max_s: float | None = None) -> None:
    s = get_settings()
    lo = min_s if min_s is not None else s.scrape_delay_min
    hi = max_s if max_s is not None else s.scrape_delay_max
    await asyncio.sleep(random.uniform(lo, hi))


async def human_scroll(page: Page) -> None:
    """Scroll in irregular steps to trigger lazy-load and look human."""
    pos = 0
    height = await page.evaluate("document.body.scrollHeight")
    while pos < height:
        pos += random.randint(220, 620)
        await page.evaluate(f"window.scrollTo({{top: {pos}, behavior: 'smooth'}})")
        await asyncio.sleep(random.uniform(0.4, 1.6))
        height = await page.evaluate("document.body.scrollHeight")


async def human_mouse(page: Page) -> None:
    """Drift mouse along a few random points."""
    for _ in range(random.randint(2, 5)):
        x = random.randint(50, 1200)
        y = random.randint(50, 700)
        await page.mouse.move(x, y, steps=random.randint(8, 20))
        await asyncio.sleep(random.uniform(0.1, 0.4))


@asynccontextmanager
async def stealth_context() -> AsyncIterator[tuple[Browser, BrowserContext]]:
    s = get_settings()
    ua = UserAgent().random
    viewport = random.choice(VIEWPORTS)
    locale = random.choice(LOCALES)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=s.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )
        context = await browser.new_context(
            user_agent=ua,
            viewport=viewport,
            locale=locale,
            timezone_id="Asia/Bangkok",
            extra_http_headers={"Accept-Language": f"{locale},en;q=0.9"},
        )
        logger.info(
            f"context: ua={ua[:60]}... viewport={viewport['width']}x{viewport['height']} locale={locale}"
        )
        try:
            yield browser, context
        finally:
            await context.close()
            await browser.close()


async def new_stealth_page(context: BrowserContext) -> Page:
    page = await context.new_page()
    await stealth_async(page)
    return page


PROFILE_DIR_DEFAULT = os.path.join(os.getcwd(), ".playwright-profile")


@asynccontextmanager
async def persistent_context(
    profile_dir: str | None = None,
) -> AsyncIterator[BrowserContext]:
    """Persistent Chromium profile — cookies/storage survive across runs.

    First run: user solves any Cloudflare challenge in the visible browser
    once; the profile then keeps those cookies on disk. Subsequent runs reuse
    the same profile and typically skip the challenge.

    Always launches non-headless (challenges aren't solvable headless).
    """
    s = get_settings()
    profile = profile_dir or PROFILE_DIR_DEFAULT
    os.makedirs(profile, exist_ok=True)
    viewport = random.choice(VIEWPORTS)

    # Cloudflare Turnstile fingerprints heavily on automation tells; suppress
    # the most reliable ones: the "automation-controlled" banner, navigator.
    # webdriver=true, and the bundled-Chromium build. Prefer real Chrome via
    # channel='chrome' if installed on this machine — far more natural
    # fingerprint than playwright's bundled chromium.
    launch_args = [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",
    ]
    common_kwargs: dict = dict(
        user_data_dir=profile,
        headless=False,
        viewport=viewport,
        locale="en-US",
        timezone_id="Asia/Bangkok",
        args=launch_args,
        ignore_default_args=["--enable-automation"],
    )

    async with async_playwright() as pw:
        try:
            ctx = await pw.chromium.launch_persistent_context(
                channel="chrome", **common_kwargs
            )
            channel_used = "chrome"
        except Exception as e:
            logger.warning(
                f"persistent context: real Chrome unavailable ({e}); "
                f"falling back to bundled Chromium"
            )
            ctx = await pw.chromium.launch_persistent_context(**common_kwargs)
            channel_used = "chromium"

        logger.info(
            f"persistent context: profile={profile} channel={channel_used} "
            f"viewport={viewport['width']}x{viewport['height']} "
            f"(headless ignored: {s.headless})"
        )
        try:
            yield ctx
        finally:
            await ctx.close()


CHALLENGE_TITLES = ("just a moment", "verifying you are human", "attention required")


async def wait_past_challenge(page: Page, max_wait_s: int = 180) -> bool:
    """If a Cloudflare-style challenge page is visible, wait for the user to
    solve it. Returns True once the title indicates a normal page (or never
    blocked). False on timeout.

    Polls the title every 2s and logs progress so the user knows what to do.
    """
    deadline = max_wait_s // 2
    warned = False
    for _ in range(deadline):
        try:
            title = (await page.title()) or ""
        except Exception:
            return False
        if not any(m in title.lower() for m in CHALLENGE_TITLES):
            if warned:
                logger.info(f"[challenge] cleared, title={title!r}")
            return True
        if not warned:
            logger.warning(
                f"[challenge] Cloudflare challenge detected — please solve it "
                f"in the browser window (waiting up to {max_wait_s}s). "
                f"title={title!r}"
            )
            warned = True
        await asyncio.sleep(2)
    logger.error("[challenge] timed out waiting for user to solve challenge")
    return False
