/** Bangkok's 50 khet with their RealData flood-risk level (0-5).
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
  /** Thai khet name, incl. the "เขต" prefix. Used verbatim on /th. */
  nameTh: string;
  /** 0 = no observed flooding, 5 = repeat full-area monsoon inundation. */
  level: number;
};

/** Ordered riskiest-first, so slicing the head gives the "avoid" list and
 *  slicing the tail gives the "safe" list without re-sorting. */
export const FLOOD_DISTRICTS: FloodDistrict[] = [
  { slug: "bang-khen", name: "Bang Khen", aka: [], nameTh: "เขตบางเขน", level: 5 },
  { slug: "bang-khun-thian", name: "Bang Khun Thian", aka: [], nameTh: "เขตบางขุนเทียน", level: 5 },
  { slug: "don-mueang", name: "Don Mueang", aka: [], nameTh: "เขตดอนเมือง", level: 5 },
  { slug: "khlong-sam-wa", name: "Khlong Sam Wa", aka: [], nameTh: "เขตคลองสามวา", level: 5 },
  { slug: "lak-si", name: "Lak Si", aka: [], nameTh: "เขตหลักสี่", level: 5 },
  { slug: "lat-krabang", name: "Lat Krabang", aka: [], nameTh: "เขตลาดกระบัง", level: 5 },
  { slug: "min-buri", name: "Min Buri", aka: [], nameTh: "เขตมีนบุรี", level: 5 },
  { slug: "nong-chok", name: "Nong Chok", aka: [], nameTh: "เขตหนองจอก", level: 5 },
  { slug: "sai-mai", name: "Sai Mai", aka: [], nameTh: "เขตสายไหม", level: 5 },
  { slug: "bang-bon", name: "Bang Bon", aka: [], nameTh: "เขตบางบอน", level: 4 },
  { slug: "bang-khae", name: "Bang Khae", aka: [], nameTh: "เขตบางแค", level: 4 },
  { slug: "bang-phlat", name: "Bang Phlat", aka: [], nameTh: "เขตบางพลัด", level: 4 },
  { slug: "bueng-kum", name: "Bueng Kum", aka: [], nameTh: "เขตบึงกุ่ม", level: 4 },
  { slug: "khan-na-yao", name: "Khan Na Yao", aka: [], nameTh: "เขตคันนายาว", level: 4 },
  { slug: "nong-khaem", name: "Nong Khaem", aka: [], nameTh: "เขตหนองแขม", level: 4 },
  { slug: "prawet", name: "Prawet", aka: ["Praves"], nameTh: "เขตประเวศ", level: 4 },
  { slug: "saphan-sung", name: "Saphan Sung", aka: [], nameTh: "เขตสะพานสูง", level: 4 },
  { slug: "taling-chan", name: "Taling Chan", aka: [], nameTh: "เขตตลิ่งชัน", level: 4 },
  { slug: "thawi-watthana", name: "Thawi Watthana", aka: [], nameTh: "เขตทวีวัฒนา", level: 4 },
  { slug: "bang-kapi", name: "Bang Kapi", aka: ["Bangkapi"], nameTh: "เขตบางกะปิ", level: 3 },
  { slug: "bang-kho-laem", name: "Bang Kho Laem", aka: [], nameTh: "เขตบางคอแหลม", level: 3 },
  { slug: "bang-na", name: "Bang Na", aka: [], nameTh: "เขตบางนา", level: 3 },
  { slug: "bang-sue", name: "Bang Sue", aka: ["Bang Su"], nameTh: "เขตบางซื่อ", level: 3 },
  { slug: "bangkok-noi", name: "Bangkok Noi", aka: [], nameTh: "เขตบางกอกน้อย", level: 3 },
  { slug: "bangkok-yai", name: "Bangkok Yai", aka: [], nameTh: "เขตบางกอกใหญ่", level: 3 },
  { slug: "chatuchak", name: "Chatuchak", aka: ["Jatujak"], nameTh: "เขตจตุจักร", level: 3 },
  { slug: "chom-thong", name: "Chom Thong", aka: [], nameTh: "เขตจอมทอง", level: 3 },
  { slug: "khlong-san", name: "Khlong San", aka: [], nameTh: "เขตคลองสาน", level: 3 },
  { slug: "lat-phrao", name: "Lat Phrao", aka: ["Ladprao"], nameTh: "เขตลาดพร้าว", level: 3 },
  { slug: "phasi-charoen", name: "Phasi Charoen", aka: ["Pasi Charoen"], nameTh: "เขตภาษีเจริญ", level: 3 },
  { slug: "phra-khanong", name: "Phra Khanong", aka: ["Prakanong"], nameTh: "เขตพระโขนง", level: 3 },
  { slug: "rat-burana", name: "Rat Burana", aka: [], nameTh: "เขตราษฎร์บูรณะ", level: 3 },
  { slug: "suan-luang", name: "Suan Luang", aka: ["Suanluang"], nameTh: "เขตสวนหลวง", level: 3 },
  { slug: "thon-buri", name: "Thon Buri", aka: ["Thonburi"], nameTh: "เขตธนบุรี", level: 3 },
  { slug: "thung-khru", name: "Thung Khru", aka: [], nameTh: "เขตทุ่งครุ", level: 3 },
  { slug: "wang-thonglang", name: "Wang Thonglang", aka: [], nameTh: "เขตวังทองหลาง", level: 3 },
  { slug: "yan-nawa", name: "Yan Nawa", aka: ["Yannawa"], nameTh: "เขตยานนาวา", level: 3 },
  { slug: "din-daeng", name: "Din Daeng", aka: ["Dindaeng"], nameTh: "เขตดินแดง", level: 2 },
  { slug: "dusit", name: "Dusit", aka: [], nameTh: "เขตดุสิต", level: 2 },
  { slug: "huai-khwang", name: "Huai Khwang", aka: ["Huay Kwang"], nameTh: "เขตห้วยขวาง", level: 2 },
  { slug: "khlong-toei", name: "Khlong Toei", aka: ["Klong Toey"], nameTh: "เขตคลองเตย", level: 2 },
  { slug: "phaya-thai", name: "Phaya Thai", aka: [], nameTh: "เขตพญาไท", level: 2 },
  { slug: "phra-nakhon", name: "Phra Nakhon", aka: [], nameTh: "เขตพระนคร", level: 2 },
  { slug: "samphanthawong", name: "Samphanthawong", aka: [], nameTh: "เขตสัมพันธวงศ์", level: 2 },
  { slug: "vadhana", name: "Watthana", aka: ["Wattana", "Vadhana"], nameTh: "วัฒนา", level: 2 },
  { slug: "bang-rak", name: "Bang Rak", aka: [], nameTh: "เขตบางรัก", level: 1 },
  { slug: "pathum-wan", name: "Pathum Wan", aka: [], nameTh: "เขตปทุมวัน", level: 1 },
  { slug: "pom-prap-sattru-phai", name: "Pom Prap Sattru Phai", aka: [], nameTh: "เขตป้อมปราบศัตรูพ่าย", level: 1 },
  { slug: "ratchathewi", name: "Ratchathewi", aka: ["Rajthevi"], nameTh: "เขตราชเทวี", level: 1 },
  { slug: "sathon", name: "Sathorn", aka: ["Sathon"], nameTh: "เขตสาทร", level: 1 },
];

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
