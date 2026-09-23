/**
 * The area comparisons published at /[lang]/vs/[pair].
 *
 * Why this route exists: /blog/sukhumvit-vs-sathorn-condo-comparison averages
 * position 8.8 with 56 impressions (GSC, 2026-09-15) — the best-ranking page
 * on the site, because "X vs Y" is a question portals do not answer. It is
 * 553 lines of hand-written JSX, so it was never repeated. These pairs render
 * from measured data instead.
 *
 * Bangkok pairs compare BTS/MRT catchments (Thonglor and Ekkamai are both in
 * Watthana, so the khet cannot tell them apart); everywhere else compares
 * districts, which is the granularity the DB has outside Bangkok.
 *
 * A pair whose sides lack data is dropped at build time rather than shipping
 * an empty comparison — see lib/queries/areaCompare.ts.
 */
export type ComparePair = {
  /** URL slug: always "<a>-vs-<b>". */
  slug: string;
  kind: "station" | "district";
  a: string;
  b: string;
  /** district pairs only: the city both sides belong to (yield-page links). */
  city?: string;
};

export const COMPARE_PAIRS: ComparePair[] = [
  // Bangkok: the four corridors people actually choose between.
  { slug: "thong-lo-vs-ekkamai", kind: "station", a: "thong-lo", b: "ekkamai" },
  { slug: "asok-vs-phrom-phong", kind: "station", a: "asok", b: "phrom-phong" },
  { slug: "on-nut-vs-phra-khanong", kind: "station", a: "on-nut", b: "phra-khanong" },
  { slug: "sala-daeng-vs-chong-nonsi", kind: "station", a: "sala-daeng", b: "chong-nonsi" },
  { slug: "ari-vs-phaya-thai", kind: "station", a: "ari", b: "phaya-thai" },
  { slug: "ratchathewi-vs-huai-khwang", kind: "station", a: "ratchathewi", b: "huai-khwang" },
  // Pattaya.
  { slug: "jomtien-vs-pratumnak", kind: "district", a: "jomtien", b: "pratumnak", city: "pattaya" },
  { slug: "north-pattaya-vs-south-pattaya", kind: "district", a: "north-pattaya", b: "south-pattaya", city: "pattaya" },
  { slug: "central-pattaya-vs-east-pattaya", kind: "district", a: "central-pattaya", b: "east-pattaya", city: "pattaya" },
  // Phuket: Laguna and Bang Tao sit in Thalang, which is where the
  // "laguna phuket rental yield" searches land.
  { slug: "thalang-vs-kathu", kind: "district", a: "thalang", b: "kathu", city: "phuket" },
  { slug: "phuket-town-vs-kathu", kind: "district", a: "phuket-town", b: "kathu", city: "phuket" },
  // Chiang Mai.
  { slug: "mueang-chiang-mai-vs-san-sai", kind: "district", a: "mueang-chiang-mai", b: "san-sai", city: "chiangmai" },
  { slug: "hang-dong-vs-san-kamphaeng", kind: "district", a: "hang-dong", b: "san-kamphaeng", city: "chiangmai" },
];

export function findComparePair(slug: string): ComparePair | null {
  return COMPARE_PAIRS.find((p) => p.slug === slug) ?? null;
}

/** Station names as searchers write them. stationSlug() round-trips to a
 *  hyphenated slug, and title-casing that gives "Thong Lo" where every
 *  listing, agent and search query says "Thonglor". */
const STATION_DISPLAY: Record<string, string> = {
  "thong-lo": "Thonglor",
  ekkamai: "Ekkamai",
  asok: "Asok",
  "phrom-phong": "Phrom Phong",
  "on-nut": "On Nut",
  "phra-khanong": "Phra Khanong",
  "sala-daeng": "Sala Daeng",
  "chong-nonsi": "Chong Nonsi",
  ari: "Ari",
  "phaya-thai": "Phaya Thai",
  ratchathewi: "Ratchathewi",
  "huai-khwang": "Huai Khwang",
};

export function stationDisplayName(slug: string): string {
  return (
    STATION_DISPLAY[slug] ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
