import json, os, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
t = open(os.path.join(os.path.dirname(__file__), "tbm_map.txt"), encoding="utf-8").read()
data = json.loads(t[t.find("\n")+1:] if t.startswith(")]}'") else t)
p = data[0][1][0][14]

print("len(p[4]) =", len(p[4]), " p[4] =", p[4])

# find every float in 1..5 and every int 10..99,999,999 inside p, with path
hits = []
def walk(node, path):
    if isinstance(node, list):
        for i, x in enumerate(node):
            walk(x, path + [i])
    elif isinstance(node, float) and 1.0 <= node <= 5.0:
        hits.append(("FLOAT", path, node))
    elif isinstance(node, int) and 10 <= node <= 99_999_999:
        hits.append(("INT", path, node))
walk(p, [])

print("\n-- ratings (float 1-5) in place --")
for kind, path, v in hits:
    if kind == "FLOAT":
        print(" ", "".join(f"[{i}]" for i in path), "=", v)

print("\n-- candidate review-counts (int) near a rating path --")
# show ints whose path prefix overlaps a rating path
rating_paths = [path for k, path, v in hits if k == "FLOAT"]
for kind, path, v in hits:
    if kind == "INT" and any(path[:3] == rp[:3] for rp in rating_paths):
        print(" ", "".join(f"[{i}]" for i in path), "=", v)
