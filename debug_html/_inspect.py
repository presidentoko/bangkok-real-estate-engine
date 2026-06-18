import re, glob, json

f = "c3295bac-c787-4f2e-930a-53b3941cdcfe.html"
h = open(f, encoding="utf-8", errors="replace").read()

print("=== window around 'Condo One' (86082) ===")
print(repr(h[85950:86550]))
print()

marker = ")]}'"
i = h.find(marker)
print("results marker )]}' at:", i)

# Element [3] of APP_INITIALIZATION_STATE is a quoted JS string holding the
# results payload. Find the big escaped-JSON string after the marker.
# Look for review-count words in any language Google might emit.
for kw in ["рейтинг", "件のレビュー", "리뷰", "ratingCount", "userRating", "/g/", "0x"]:
    print(f"  has {kw!r}:", kw in h)

# show all 0x feature ids (place CIDs)
cids = re.findall(r"0x[0-9a-f]{6,}:0x[0-9a-f]{6,}", h)
print("feature CIDs found:", len(cids), cids[:5])
