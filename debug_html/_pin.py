"""Pin the exact indices for name / rating / review-count / cid of the PRIMARY
result in a tbm=map response."""
import json, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

t = open(os.path.join(os.path.dirname(__file__), "tbm_map.txt"), encoding="utf-8").read()
body = t[t.find("\n")+1:] if t.startswith(")]}'") else t
data = json.loads(body)

results = data[0][1]
print("num result slots:", len(results))

def brief(x, n=70):
    s = repr(x)
    return s if len(s) <= n else s[:n] + "..."

for ri, res in enumerate(results[:6]):
    if not (isinstance(res, list) and len(res) > 14 and isinstance(res[14], list)):
        print(f"\nresult[{ri}]: no place at [14] -> {brief(res)}")
        continue
    p = res[14]
    print(f"\n=== result[{ri}]  place=res[14] (len {len(p)}) ===")
    # name is usually p[11]; rating block p[4] = [null,null,null,null,null,null,null,rating,count]
    print("  p[11] (name?):", brief(p[11]) if len(p) > 11 else "n/a")
    if len(p) > 4 and isinstance(p[4], list):
        print("  p[4] (rating block):", brief(p[4], 120))
        if len(p[4]) > 8:
            print("    -> p[4][7] rating =", p[4][7], " p[4][8] count =", p[4][8])
    # CID often at p[10] like '0x...:0x...'
    print("  p[10] (cid?):", brief(p[10]) if len(p) > 10 else "n/a")
