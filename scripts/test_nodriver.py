"""Quick nodriver smoke test — verify CF passage + evaluate result format."""
from __future__ import annotations

import asyncio
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc  # noqa: E402


async def main():
    profile = os.path.join(os.getcwd(), ".nodriver-profile")
    os.makedirs(profile, exist_ok=True)
    browser = await uc.start(
        headless=False,
        user_data_dir=profile,
        browser_args=["--lang=en-US"],
    )
    try:
        url = "https://www.hipflat.co.th/en/thailand-projects/condo/bangkok-bm"
        print(f"GET {url}")
        tab = await browser.get(url)
        try:
            await tab.verify_cf()
        except Exception as e:
            print(f"  verify_cf: {e}")
        await tab.sleep(5)

        # 1) Title + body length
        title = await tab.evaluate("document.title")
        body_len = await tab.evaluate(
            "(document.body && document.body.textContent || '').length"
        )
        a_total = await tab.evaluate("document.querySelectorAll('a[href]').length")
        print(f"  title={title!r}  body_chars={body_len}  a_total={a_total}")

        # 2) Test evaluate return format with nested list
        sample = await tab.evaluate("[[1,'a'],[2,'b']]")
        print(f"  nested-array eval: type={type(sample).__name__} value={sample!r}")

        # 3) Khet directory link count
        khet_count = await tab.evaluate(
            "document.querySelectorAll(\"a[href*='/thailand-projects/condo/bangkok-bm/']\").length"
        )
        print(f"  khet-prefix matches in DOM: {khet_count}")

        # 4) First 8 href samples (any href that has 'thailand-projects' or 'condo')
        samples = await tab.evaluate("""
            (() => {
              const out = [];
              for (const a of document.querySelectorAll('a[href]')) {
                const h = a.getAttribute('href') || '';
                if (h.includes('thailand-projects') || h.includes('/condo/')) {
                  out.push([h, a.getAttribute('title') || '']);
                  if (out.length >= 8) break;
                }
              }
              return out;
            })()
        """)
        print(f"  href samples: type={type(samples).__name__}")
        if samples:
            for s in samples:
                print(f"    {s}")
        else:
            print("    (none — page rendering not yet ready, or different URL pattern)")

    finally:
        try:
            browser.stop()
        except Exception:
            pass


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
