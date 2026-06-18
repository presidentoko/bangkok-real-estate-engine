"""Robustly fetch ONE known-rated place (ICONSIAM) through whatever SOCKS port
is alive right now, save HTML, and write a structural analysis to _findings.txt."""
import sys, os, re, time
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv()

import httpx
from urllib.parse import quote_plus
from src.net.proxy_pool import ProxyPool
from src.scrapers.google_places_scrape import _SEARCH_URL, _HEADERS, _COOKIES

OUT = open(os.path.join(os.path.dirname(__file__), "_findings.txt"), "w", encoding="utf-8")
def w(*a):
    print(*a, flush=True)
    OUT.write(" ".join(str(x) for x in a) + "\n"); OUT.flush()

pool = ProxyPool.from_env()
query = "ICONSIAM Bangkok"
url = _SEARCH_URL.format(q=quote_plus(query))

html = None
for attempt in range(24):
    proxy = pool.acquire()
    try:
        with httpx.Client(proxy=proxy, headers=_HEADERS, cookies=_COOKIES,
                          timeout=25, follow_redirects=True) as c:
            r = c.get(url)
        if r.status_code == 200 and "APP_INITIALIZATION_STATE" in r.text:
            pool.report(proxy, True)
            html = r.text
            w(f"OK on attempt {attempt+1} via {proxy.rsplit(':',1)[-1]}  len={len(html)}")
            break
        pool.report(proxy, False)
        w(f"  attempt {attempt+1}: status={r.status_code} len={len(r.text)}")
    except Exception as e:
        pool.report(proxy, False)
        w(f"  attempt {attempt+1}: {type(e).__name__}")
    time.sleep(2)

if not html:
    w("ALL ATTEMPTS FAILED")
    sys.exit(0)

open(os.path.join(os.path.dirname(__file__), "iconsiam.html"), "w", encoding="utf-8").write(html)

# Structural analysis -------------------------------------------------------
w("\n--- structure ---")
w("title:", (re.search(r"<title[^>]*>(.*?)</title>", html, re.S) or [None, "?"])[1].strip()[:80])

# the )]}' payload — an escaped JS string in the HTML
i = html.find(")]}'")
w(")]}' marker at:", i)
seg = html[i:i+4000] if i != -1 else ""
w("payload head (unescaped-ish):", repr(seg[:500]))

# Find rating floats and their context. ICONSIAM rating ~4.6, reviews ~100k+.
for fl in re.finditer(r'(?<![\d.])([1-5]\.\d)(?![\d])', html):
    val = fl.group(1)
    if val in ("4.5", "4.6", "4.7", "4.4", "4.3"):
        s = fl.start()
        w(f"  rating-candidate {val} @ {s}: {html[s-30:s+80]!r}")
        break

# Look for big review-count ints (10k-999k) near a rating float
for m in re.finditer(r'([1-5]\.\d)[^\d]{1,40}(\d{4,7})', html):
    w(f"  pair candidate: rating={m.group(1)} count={m.group(2)}  ctx={html[m.start()-10:m.start()+90]!r}")
    break

OUT.close()
