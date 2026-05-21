"""Warm Vercel + edge CDN cache for the 189 /best/[city]/[slug] pages
plus the new weekly blog route. Runs through every URL once with a
realistic User-Agent so Next.js renders + Vercel caches the response.

Usage: python scripts/warm_best_pages.py
"""
from __future__ import annotations

import sys
import time

import requests

CITIES = [
    "bangkok", "phuket", "chon-buri", "chiang-mai", "pattaya",
    "hua-hin", "ko-samui", "krabi", "chiang-rai",
]
SLUGS = [
    "under-3m", "under-5m", "under-10m", "under-20m",
    "top-yield", "under-5m-top-yield", "under-10m-top-yield",
]
LANGS = ["en", "ko", "th"]
BASE = "https://www.passionaryestate.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (RealData/cache-warm; +https://passionaryestate.com)",
    "Accept": "text/html,application/xhtml+xml",
}

EXTRA = [
    "/en",
    "/en/yields",
    "/en/macro",
    "/en/ask",
    "/en/inventory",
    "/en/flood",
    "/en/blog",
]


def hit(path: str) -> tuple[int, int, float]:
    url = f"{BASE}{path}"
    t0 = time.monotonic()
    try:
        r = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=False)
        dur = time.monotonic() - t0
        return r.status_code, len(r.content), dur
    except requests.RequestException as e:
        print(f"  ERR {path}: {e}", flush=True)
        return -1, 0, time.monotonic() - t0


def main() -> int:
    urls: list[str] = []
    for lang in LANGS:
        for city in CITIES:
            for slug in SLUGS:
                urls.append(f"/{lang}/best/{city}/{slug}")
    urls.extend(EXTRA)

    total = len(urls)
    ok, redir, miss, err = 0, 0, 0, 0
    sizes = []
    durs = []
    print(f"[warm] hitting {total} URLs on {BASE}", flush=True)

    for i, p in enumerate(urls, 1):
        code, size, dur = hit(p)
        sizes.append(size)
        durs.append(dur)
        if 200 <= code < 300:
            ok += 1
            tag = "OK"
        elif 300 <= code < 400:
            redir += 1
            tag = f"{code}"
        elif 400 <= code < 500:
            miss += 1
            tag = f"{code}"
        else:
            err += 1
            tag = f"E{code}"
        # Print one progress line every 25 URLs + every non-200
        if i % 25 == 0 or code != 200:
            print(f"  [{i:3d}/{total}] {tag:>4}  {dur*1000:.0f}ms  {size:>6}B  {p}", flush=True)

    avg_kb = sum(sizes) / total / 1024 if total else 0
    avg_ms = sum(durs) / total * 1000 if total else 0
    print(
        f"\n[warm] done. ok={ok} redir={redir} 4xx={miss} 5xx/err={err} "
        f"avg={avg_ms:.0f}ms / {avg_kb:.1f}KB",
        flush=True,
    )
    return 0 if (ok + redir) >= total * 0.9 else 1


if __name__ == "__main__":
    sys.exit(main())
