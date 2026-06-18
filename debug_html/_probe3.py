"""Test the Google Maps tbm=map XHR endpoint (the one that actually carries
ratings) through the SOCKS pool. Dumps result to _findings3.txt."""
import sys, os, re, time, json
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from dotenv import load_dotenv
load_dotenv()

import httpx
from urllib.parse import quote_plus
from src.net.proxy_pool import ProxyPool

OUT = open(os.path.join(os.path.dirname(__file__), "_findings3.txt"), "w", encoding="utf-8")
def w(*a):
    OUT.write(" ".join(str(x) for x in a) + "\n"); OUT.flush()

pool = ProxyPool.from_env()

query = "ICONSIAM Bangkok"
# Bangkok-centred viewport. The pb below is a known-working maps search payload;
# !7i20 = 20 results, !2s<query> carries the text query inside pb as well.
lat, lng = 13.7563, 100.5018
pb = (
    "!4m12!1m3!1d20000!2d{lng}!3d{lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768"
    "!4f13.1!7i20!10b1!12m9!1m1!18b1!2m3!5m1!6e2!20e3!10b1!16b1"
    "!19m4!2m3!1i360!2i120!4i8!20m48!2m2!1i203!2i100!3m2!2i4!5b1"
    "!6m6!1m2!1i86!2i86!1m2!1i408!2i240!7m33!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2"
    "!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2"
    "!1m3!1e10!2b0!3e4!2b1!4b1!9b0!22m3!1e81!12e3!17e15!24m1!1e0"
).format(lat=lat, lng=lng)
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
url = (f"https://www.google.com/search?tbm=map&authuser=0&hl=en&gl=th"
       f"&q={quote_plus(query)}&pb={pb}")

text = None
for attempt in range(24):
    proxy = pool.acquire()
    try:
        with httpx.Client(proxy=proxy, headers=headers,
                          cookies={"CONSENT": "YES+cb"},
                          timeout=25, follow_redirects=True) as c:
            r = c.get(url)
        if r.status_code == 200 and len(r.text) > 1000:
            pool.report(proxy, True)
            text = r.text
            w(f"OK attempt {attempt+1} via {proxy.rsplit(':',1)[-1]} "
              f"status={r.status_code} len={len(text)}")
            break
        pool.report(proxy, False)
        w(f"  attempt {attempt+1}: status={r.status_code} len={len(r.text)}")
    except Exception as e:
        pool.report(proxy, False)
        w(f"  attempt {attempt+1}: {type(e).__name__}")
    time.sleep(2)

if not text:
    w("ALL FAILED"); OUT.close(); sys.exit(0)

open(os.path.join(os.path.dirname(__file__), "tbm_map.txt"), "w", encoding="utf-8").write(text)
w("head:", repr(text[:200]))

# strip )]}' and parse
body = text
if body.startswith(")]}'"):
    body = body[body.find("\n")+1:]
try:
    data = json.loads(body)
    w("JSON parsed OK. top-level len:", len(data) if isinstance(data, list) else "obj")
except Exception as e:
    w("json.loads failed:", type(e).__name__, str(e)[:100])
    data = None

# Recursively hunt for [..., rating(float 1-5), reviewCount(int)] near a name str.
found = []
def walk(node, path=""):
    if isinstance(node, list):
        # rating heuristic: a float 1-5 followed somewhere by an int >0
        for i, x in enumerate(node):
            if isinstance(x, float) and 1.0 <= x <= 5.0:
                # look for an int review count nearby in same list
                nbrs = node[max(0,i-1):i+4]
                ints = [y for y in nbrs if isinstance(y, int) and 0 < y < 10_000_000]
                if ints:
                    found.append((path, x, ints))
            walk(x, f"{path}[{i}]")
if data is not None:
    walk(data)
    w(f"\nrating-candidates found: {len(found)}")
    for p, rt, ints in found[:15]:
        w(f"  {p}: rating={rt} nearby_ints={ints}")

OUT.close()
