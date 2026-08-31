# -*- coding: utf-8 -*-
"""Regenerate web/lib/floodDistricts.ts from the district GeoJSON.

The flood layer lives in web/public/bangkok-districts.geojson, which is
334KB of polygon geometry wrapped around three fields the district flood
pages actually need (name, name_th, flood_risk_level). Rather than parse
that file 150 times at render (50 khet x 3 locales), commit the projection
as a TypeScript table and rerun this whenever the layer's risk levels are
revised -- per lib/dictionaries the layer is reviewed annually after the
BMA monsoon report.

    python scripts/gen_flood_districts.py
"""
import io
import json
import os

# Alternate romanisations, keyed by the slug this layer uses.
#
# The GeoJSON carries the OSM spelling, which for two central khet is not
# the one anybody types: the layer says "Vadhana" and "Sathon", while
# every listing site, BTS map and search query says Watthana and Sathorn.
# A flood page titled "Does Vadhana flood?" wins no query at all.
#
# First entry becomes the DISPLAY name (what goes in the <title>, the H1
# and every chip); the layer spelling is kept and shown as an alt. Every
# entry, display or not, resolves as a URL alias so an inbound link on any
# common spelling lands on the page instead of 404ing.
AKA = {
    "vadhana": ["Watthana", "Wattana"],
    "sathon": ["Sathorn"],
    "khlong-toei": ["Klong Toey"],
    "thon-buri": ["Thonburi"],
    "huai-khwang": ["Huay Kwang"],
    "phra-khanong": ["Prakanong"],
    "bang-kapi": ["Bangkapi"],
    "din-daeng": ["Dindaeng"],
    "yan-nawa": ["Yannawa"],
    "chatuchak": ["Jatujak"],
    "ratchathewi": ["Rajthevi"],
    "bang-sue": ["Bang Su"],
    "lat-phrao": ["Ladprao"],
    "phasi-charoen": ["Pasi Charoen"],
    "prawet": ["Praves"],
    "suan-luang": ["Suanluang"],
}

# Slugs where the alternate spelling, not the layer's, is what readers
# search. Keep this list short and only for spellings that are genuinely
# dominant -- renaming a khet we render is not a cosmetic change.
DISPLAY_FROM_AKA = {"vadhana", "sathon"}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "web", "public", "bangkok-districts.geojson")
DST = os.path.join(ROOT, "web", "lib", "floodDistricts.ts")

HEADER = '''/** Bangkok's 50 khet with their RealData flood-risk level (0-5).
 *
 *  Derived from public/bangkok-districts.geojson -- the same layer the
 *  interactive map on /flood renders -- by scripts/gen_flood_districts.py.
 *  Committed as a table rather than read at request time because the
 *  GeoJSON is 334KB of polygon geometry and these three fields are all the
 *  district pages need; parsing it 150 times (50 districts x 3 locales) to
 *  recover one integer each was the only alternative. Regenerate with:
 *
 *      python scripts/gen_flood_districts.py
 *
 *  `slug` is name.toLowerCase() with spaces hyphenated, which is exactly
 *  the canonical /district/<slug> form (regions.name after
 *  normalize_regions_and_provinces.py) -- verified against sitemap-areas.xml
 *  on 2026-08-31: all 50 resolve to a live district page. Keep it that way,
 *  because every flood page links to its district twin.
 *
 *  GENERATED FILE -- edit the GeoJSON and rerun the script, not this. */
export type FloodDistrict = {
  slug: string;
  /** The romanisation to print -- usually the layer's, but Watthana and
   *  Sathorn override it because the layer's Vadhana/Sathon spellings are
   *  not what anyone searches or writes. */
  name: string;
  /** Other romanisations in circulation, incl. the layer's own where
   *  `name` overrides it. Resolved as URL aliases; the first is shown
   *  under the H1 so the page is findable under either spelling. */
  aka: string[];
  /** Thai khet name, incl. the "\u0e40\u0e02\u0e15" prefix. Used verbatim on /th. */
  nameTh: string;
  /** 0 = no observed flooding, 5 = repeat full-area monsoon inundation. */
  level: number;
};

/** Ordered riskiest-first, so slicing the head gives the "avoid" list and
 *  slicing the tail gives the "safe" list without re-sorting. */
export const FLOOD_DISTRICTS: FloodDistrict[] = [
'''

FOOTER = r'''];

const slugify = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "-");

/** Canonical slug AND every alternate romanisation point at the same
 *  district, so /flood/watthana and /flood/vadhana both resolve. Only the
 *  canonical slug is ever linked or published to the sitemap, and the page
 *  declares it as canonical, so the alias is a fallback for inbound links,
 *  not a second indexable URL. */
const BY_SLUG = new Map<string, FloodDistrict>();
for (const d of FLOOD_DISTRICTS) {
  BY_SLUG.set(d.slug, d);
  // d.name too, not just d.aka: where the display name overrides the
  // layer's (Watthana over Vadhana), the spelling we print is the one a
  // reader will type into the URL bar, and it is NOT the slug.
  BY_SLUG.set(slugify(d.name), d);
  for (const alt of d.aka) BY_SLUG.set(slugify(alt), d);
}

/** Route param -> district. Accepts the same loose spellings
 *  district/[slug] does (percent-encoded, spaced, mixed case) so a link
 *  from an old index entry still resolves instead of 404ing. */
export function findFloodDistrict(raw: string): FloodDistrict | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return BY_SLUG.get(slugify(decoded)) ?? null;
}

/** 1-based position in the riskiest-first ordering, for "Nth of 50". */
export function floodRank(slug: string): number {
  return FLOOD_DISTRICTS.findIndex((d) => d.slug === slug) + 1;
}
'''


def main() -> None:
    features = json.load(io.open(SRC, encoding="utf-8"))["features"]
    rows = []
    for f in features:
        p = f["properties"]
        level = p.get("flood_risk_level")
        if not p.get("name") or not isinstance(level, int):
            continue
        rows.append((p["name"].lower().replace(" ", "-"), p["name"], p.get("name_th") or "", level))
    rows.sort(key=lambda r: (-r[3], r[1]))

    body = ""
    for slug, layer_name, th, lv in rows:
        aka = list(AKA.get(slug, []))
        if slug in DISPLAY_FROM_AKA and aka:
            name, aka = aka[0], aka[1:] + [layer_name]
        else:
            name = layer_name
        body += "  { slug: %s, name: %s, aka: %s, nameTh: %s, level: %d },\n" % (
            json.dumps(slug),
            json.dumps(name),
            json.dumps(aka),
            json.dumps(th, ensure_ascii=False),
            lv,
        )
    io.open(DST, "w", encoding="utf-8", newline="\n").write(HEADER + body + FOOTER)
    print("wrote %s with %d districts" % (DST, len(rows)))


if __name__ == "__main__":
    main()
