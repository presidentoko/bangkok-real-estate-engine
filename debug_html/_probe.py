"""Fetch a few KNOWN-rated Bangkok places through the live SOCKS pool and dump
the rating/review structure, so we can write a parser against real data."""
import sys, os, re, json, io
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx
from src.net.proxy_pool import ProxyPool
from src.scrapers.google_places_scrape import _SEARCH_URL, _HEADERS, _COOKIES
from urllib.parse import quote_plus

QUERIES = ["ICONSIAM Bangkok", "Terminal 21 Asok Bangkok", "Ashton Asoke condo Bangkok"]

pool = ProxyPool.from_env()


def fetch(query):
    url = _SEARCH_URL.format(q=quote_plus(query))
    for _ in range(len(pool)):
        proxy = pool.acquire()
        try:
            with httpx.Client(proxy=proxy, headers=_HEADERS, cookies=_COOKIES,
                              timeout=30, follow_redirects=True) as c:
                r = c.get(url)
            pool.report(proxy, True)
            return r.text
        except Exception as e:
            pool.report(proxy, False)
            print(f"   (proxy retry: {type(e).__name__})")
    return None


def analyse(query, html):
    print(f"\n===== {query} =====")
    if not html:
        print("  FETCH FAILED")
        return
    fn = re.sub(r"[^a-z0-9]+", "_", query.lower()) + ".html"
    open(os.path.join(os.path.dirname(__file__), fn), "w", encoding="utf-8").write(html)
    print(f"  saved {fn} (len={len(html)})")
    # extract the )]}' results payload (it's an escaped JS string in the HTML)
    m = re.search(r'\)\]\}\'\\n(\[.*?\])"\]', html, re.S)
    print("  results-payload regex matched:", bool(m))
    # crude: find rating-like patterns. Maps encodes rating as e.g. [4.6, 1234]
    # or rating float followed shortly by an int review count.
    pairs = re.findall(r'([1-5]\.\d)\s*,\s*null.*?,\s*(\d{2,7})', html)
    print("  naive [rating, ..., count] pairs (first 5):", pairs[:5])
    # all standalone 1-5 floats near the start of the place block
    floats = re.findall(r'(?<![\d.])([1-5]\.\d)(?![\d])', html)
    from collections import Counter
    print("  float 1-5 freq:", Counter(floats).most_common(10))
    # show context around the first plausible rating 4.x or 3.x
    for fl in ["4.", "3.", "5.0"]:
        idx = html.find(f",{fl}")
        if idx == -1:
            idx = html.find(f"[{fl}")
        if idx != -1:
            print(f"  context near {fl!r} @ {idx}: {html[idx-40:idx+120]!r}")
            break


for q in QUERIES:
    analyse(q, fetch(q))
