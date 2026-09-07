// Non-Bangkok cities currently in the DB (province column on `condos`).
// Each entry drives a /[lang]/city/[slug] landing page when published.

export type CitySlug =
  | "bangkok"
  | "pattaya"
  | "chonburi"
  | "huahin"
  | "phuket"
  | "chiangmai"
  | "krabi"
  | "samui"
  | "chiangrai";

export type City = {
  slug: CitySlug;
  /** Display name in EN/KO/TH for the city pages. */
  name: { en: string; ko: string; th: string };
  /** Search-friendly tagline (used in metadata description + hero lead). */
  tagline: { en: string; ko: string; th: string };
  /** Approximate lat/lng for the centroid — used as initial map center
   *  if the bbox computation can't form one (e.g., 1-condo edge case). */
  center: [number, number];
  /** Short audience hook for foreign investors. */
  audience: { en: string; ko: string; th: string };
};

export const CITIES: City[] = [
  {
    slug: "bangkok",
    name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพฯ" },
    tagline: {
      en: "Urban retirement hub — world-class hospitals, BTS/MRT grid, lowest cost private healthcare in Asia.",
      ko: "도심 은퇴 허브 — 세계급 병원, BTS·MRT 촘촘한 네트워크, 아시아 최저 민간 의료비.",
      th: "ศูนย์กลางผู้เกษียณในเมือง โรงพยาบาลระดับโลก BTS/MRT ครอบคลุม ค่ารักษาพยาบาลเอกชนถูกสุดในเอเชีย",
    },
    center: [100.5018, 13.7563],
    audience: {
      en: "Best for: urban retirees, medical-tourism extended stays, proximity to Bumrungrad / Samitivej",
      ko: "타겟: 도심 은퇴자, 의료 관광 장기 체류, 범룽랏·사미티벳 병원 접근 우선",
      th: "เหมาะสำหรับ: ผู้เกษียณในเมือง พำนักระยะยาวเพื่อการแพทย์ ใกล้บำรุงราษฎร์/สมิติเวช",
    },
  },
  {
    slug: "phuket",
    name: { en: "Phuket", ko: "푸켓", th: "ภูเก็ต" },
    tagline: {
      en: "Resort condos with year-round Russian + Chinese demand. Beachfront premium quantified.",
      ko: "1년 내내 러시아·중국 수요가 있는 리조트 콘도. 해변 프리미엄을 데이터로 검증.",
      th: "คอนโดรีสอร์ทที่มีดีมานด์รัสเซีย/จีนตลอดปี วัดราคาพรีเมียมหน้าหาดด้วยข้อมูล",
    },
    center: [98.3923, 7.8804],
    audience: {
      en: "Best for: yield-focused foreign investors, holiday-rental operators",
      ko: "타겟: 임대 수익형 외국인 투자자, 휴양 임대 운영자",
      th: "เหมาะสำหรับ: นักลงทุนต่างชาติเน้นผลตอบแทน, ผู้ดำเนินการเช่ารายวัน",
    },
  },
  {
    slug: "chiangmai",
    name: { en: "Chiang Mai", ko: "치앙마이", th: "เชียงใหม่" },
    tagline: {
      en: "Digital-nomad and retiree capital of Asia. Cooler air, lower prices, real foreign-resident community.",
      ko: "아시아 디지털 노마드·은퇴자 수도. 시원한 기후, 낮은 가격, 진짜 외국인 거주 커뮤니티.",
      th: "เมืองหลวงของดิจิทัลโนแมดและผู้เกษียณในเอเชีย อากาศเย็น ราคาถูก ชุมชนชาวต่างชาติจริง",
    },
    center: [98.9817, 18.7883],
    audience: {
      en: "Best for: long-term residents, retirees, digital nomads with 1-year+ stays",
      ko: "타겟: 장기 거주자, 은퇴자, 1년 이상 체류 디지털 노마드",
      th: "เหมาะสำหรับ: ผู้พำนักระยะยาว ผู้เกษียณ ดิจิทัลโนแมดที่อยู่ 1 ปีขึ้นไป",
    },
  },
  {
    slug: "pattaya",
    name: { en: "Pattaya", ko: "파타야", th: "พัทยา" },
    tagline: {
      en: "Heaviest foreign-investor market outside Bangkok. Russian, Chinese, Western retiree demand stacked.",
      ko: "방콕 외 외국인 투자 1위 시장. 러시아·중국·서양 은퇴자 수요가 겹친 곳.",
      th: "ตลาดนักลงทุนต่างชาตินอกกรุงเทพที่ใหญ่ที่สุด ดีมานด์รัสเซีย จีน ผู้เกษียณตะวันตกซ้อนทับกัน",
    },
    center: [100.8825, 12.9236],
    audience: {
      en: "Best for: yield + capital-gain investors looking for liquidity + foreign quota",
      ko: "타겟: 유동성과 외국인 quota 모두 챙기려는 임대수익+시세차익 투자자",
      th: "เหมาะสำหรับ: นักลงทุนที่ต้องการสภาพคล่องและโควตาต่างชาติพร้อมกัน",
    },
  },
  {
    slug: "huahin",
    name: { en: "Hua Hin", ko: "후아힌", th: "หัวหิน" },
    tagline: {
      en: "Quiet Scandinavian-retiree beach town. Lower volume, longer holds, more stable pricing.",
      ko: "조용한 스칸디나비안 은퇴자 해변 마을. 거래량 적고, 보유기간 길고, 가격 안정.",
      th: "เมืองชายหาดเงียบสำหรับผู้เกษียณสแกนดิเนเวีย ปริมาณน้อย ถือยาว ราคามั่นคง",
    },
    center: [99.9576, 12.5683],
    audience: {
      en: "Best for: long-stay retirees, conservative buyers wanting low-volatility coastal exposure",
      ko: "타겟: 장기 체류 은퇴자, 변동성 낮은 해안 투자처를 찾는 보수형 매수자",
      th: "เหมาะสำหรับ: ผู้เกษียณพำนักยาว ผู้ซื้อแนวอนุรักษ์นิยมที่ต้องการสินทรัพย์ชายฝั่งความผันผวนต่ำ",
    },
  },
  {
    slug: "chonburi",
    name: { en: "Chonburi", ko: "촌부리", th: "ชลบุรี" },
    tagline: {
      en: "Greater Pattaya — Sriracha, Bang Saen, Bang Lamung industrial + suburban condos.",
      ko: "광역 파타야 — 시라차, 방쌘, 방라뭉 등 산업+교외 콘도.",
      th: "พัทยาขยาย — ศรีราชา บางแสน บางละมุง คอนโดเขตอุตสาหกรรมและชานเมือง",
    },
    center: [100.9842, 13.3611],
    audience: {
      en: "Best for: industrial-corridor investors, EEC-related work-stay buyers",
      ko: "타겟: 산업 corridor 투자자, EEC 관련 직장 체류 매수자",
      th: "เหมาะสำหรับ: นักลงทุนแนว EEC ผู้ซื้อที่ทำงานในเขตอุตสาหกรรม",
    },
  },
  {
    slug: "krabi",
    name: { en: "Krabi", ko: "끄라비", th: "กระบี่" },
    tagline: {
      en: "Limestone-cliff beach market — Ao Nang, Railay. Smaller inventory, foreign-tourist demand.",
      ko: "석회암 절벽 해변 시장 — 아오낭, 라일레이. 인벤토리 작고 외국인 관광 수요.",
      th: "ตลาดชายหาดหน้าผาหินปูน — อ่าวนาง ไร่เลย์ อินเวนทอรีเล็ก ดีมานด์นักท่องเที่ยวต่างชาติ",
    },
    center: [98.9189, 8.0863],
    audience: {
      en: "Best for: vacation-rental operators, lifestyle buyers, Ao Nang regulars",
      ko: "타겟: 휴양 임대 운영자, 라이프스타일 매수자, 아오낭 단골",
      th: "เหมาะสำหรับ: ผู้ดำเนินการเช่ารายวัน ผู้ซื้อแนวไลฟ์สไตล์ ลูกค้าประจำอ่าวนาง",
    },
  },
  {
    slug: "samui",
    name: { en: "Koh Samui (Surat Thani)", ko: "코사무이 (수랏타니)", th: "เกาะสมุย (สุราษฎร์ธานี)" },
    tagline: {
      en: "Gulf-side resort island. Pool-villa-heavy market with limited condo supply but premium pricing.",
      ko: "걸프 만 리조트 섬. 풀빌라 중심 시장, 콘도 공급 제한적이지만 프리미엄 가격대.",
      th: "เกาะรีสอร์ทฝั่งอ่าวไทย ตลาดพูลวิลล่าเป็นหลัก คอนโดน้อยแต่ราคาพรีเมียม",
    },
    center: [99.9695, 9.5018],
    audience: {
      en: "Best for: holiday-rental yield seekers, second-home buyers from Hong Kong/Singapore",
      ko: "타겟: 휴양 임대 수익 추구자, 홍콩·싱가포르발 세컨드홈 매수자",
      th: "เหมาะสำหรับ: ผู้แสวงหาผลตอบแทนเช่ารายวัน ผู้ซื้อบ้านที่สองจากฮ่องกง/สิงคโปร์",
    },
  },
  {
    slug: "chiangrai",
    name: { en: "Chiang Rai", ko: "치앙라이", th: "เชียงราย" },
    tagline: {
      en: "Far north — quieter, cheaper, still-emerging condo scene. Border-trade and retiree exposure.",
      ko: "최북단 — 더 조용하고 저렴, 신흥 콘도 시장. 국경 무역 + 은퇴자.",
      th: "เหนือสุด — เงียบ ราคาถูก ตลาดคอนโดยังเกิดใหม่ การค้าชายแดน + ผู้เกษียณ",
    },
    center: [99.8326, 19.9105],
    audience: {
      en: "Best for: deep-budget retirees, frontier-market hobbyists",
      ko: "타겟: 저예산 은퇴자, 변경 시장 매니아",
      th: "เหมาะสำหรับ: ผู้เกษียณงบจำกัด ผู้สนใจตลาดชายขอบ",
    },
  },
];

export function getCity(slug: string): City | null {
  const direct = CITIES.find((c) => c.slug === slug);
  if (direct) return direct;
  // Accept DB/kebab aliases too (e.g. "chiang-mai" -> "chiangmai", "ko-samui"
  // -> "samui") so a link built from a province value or the kebab form resolves
  // to the right city instead of silently falling back to Bangkok.
  const canonical = canonicalCitySlug(slug);
  return CITIES.find((c) => c.slug === canonical) ?? null;
}

export const CITY_SLUGS = CITIES.map((c) => c.slug);

// DB `province` column has accumulated two slug conventions over time:
//   1. compact form used by the original hipflat ingest + this UI ("chiangmai",
//      "huahin", "chonburi", "samui", "chiangrai")
//   2. kebab form used by every newer scraper (DotProperty, DDProperty, FazWaz,
//      and recent hipflat runs): "chiang-mai", "hua-hin", "chon-buri",
//      "ko-samui", "chiang-rai"
// Frontend keeps the compact form as the canonical URL slug; this helper
// maps a UI slug to the set of DB values that should be considered the
// "same city" so queries can use `province IN (...)`.
const CITY_PROVINCE_ALIASES: Record<string, string[]> = {
  bangkok:   ["bangkok"],
  pattaya:   ["pattaya"],
  phuket:    ["phuket"],
  krabi:     ["krabi"],
  chiangmai: ["chiangmai", "chiang-mai"],
  huahin:    ["huahin", "hua-hin"],
  chonburi:  ["chonburi", "chon-buri"],
  samui:     ["samui", "ko-samui", "surat-thani"],
  chiangrai: ["chiangrai", "chiang-rai"],
};

/** Return the set of DB province values matching this UI city slug.
 *  Unknown slugs fall back to `[slug]` so a typo still produces a valid IN clause. */
export function cityProvinceSlugs(uiSlug: string): string[] {
  return CITY_PROVINCE_ALIASES[uiSlug] ?? [uiSlug];
}

/** Reverse mapping: given any DB province value, return the canonical UI slug.
 *  Useful when grouping/filtering an already-loaded condo set by UI slug. */
export function canonicalCitySlug(dbProvince: string | null | undefined): string {
  if (!dbProvince) return "bangkok";
  for (const [uiSlug, aliases] of Object.entries(CITY_PROVINCE_ALIASES)) {
    if (aliases.includes(dbProvince)) return uiSlug;
  }
  return dbProvince;
}

/** Human-readable label for a raw `regions.name` value.
 *
 *  regions.name is now always the lowercase-hyphen slug form ("pathum-wan"),
 *  because that doubles as the /district/ URL — see
 *  src/db.canonical_region_name. Anything rendering it to a human needs this;
 *  district/[slug] already had the transform inline, which is why the condo
 *  page started showing "vadhana" instead of "Vadhana" once the names were
 *  normalised. */
export function districtDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  const key = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const override = DISTRICT_DISPLAY_OVERRIDES[key];
  if (override) return override;
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Where the data layer's romanisation is not the one anybody types. The
 *  BMA/OSM layer says "Vadhana" and "Sathon"; every listing site, BTS map
 *  and search query says Watthana and Sathorn. The slug (and so the URL)
 *  stays as the layer has it -- lib/floodDistricts.ts resolves the popular
 *  spelling as an alias -- but nothing a reader or a search engine sees
 *  should print the layer's. */
const DISTRICT_DISPLAY_OVERRIDES: Record<string, string> = {
  vadhana: "Watthana",
  sathon: "Sathorn",
  "wang-thonglang": "Wang Thonglang",
  "wang-thong-lang": "Wang Thonglang",
};

/** Sub-areas people actually search, keyed by region slug.
 *
 *  Nobody searches "Watthana condo" -- they search Thonglor, Ekkamai and
 *  Phrom Phong, which are all inside it, and until 2026-09-07 no page on
 *  this site said so: the district <title> was the khet name alone, so a
 *  "thonglor condo price" query had nothing here to land on. These go into
 *  the district <title>, description and a line under the H1. Thai and
 *  Korean lists carry the spellings those readers type (ทองหล่อ, 통로) and
 *  fall back to the Latin list where none is given. Order is by search
 *  volume, roughly; only the first three make the <title>. */
const DISTRICT_AKA: Record<string, string[]> = {
  // Bangkok
  vadhana: ["Thonglor", "Ekkamai", "Phrom Phong", "Asoke"],
  "khlong-toei": ["Asoke", "Rama 4", "Queen Sirikit", "Sukhumvit 16-24"],
  sathon: ["Chong Nonsi", "Surasak", "Yen Akat", "Lumphini"],
  "bang-rak": ["Silom", "Charoen Krung", "Surawong", "Saphan Taksin"],
  "pathum-wan": ["Siam", "Chidlom", "Ploenchit", "Ratchadamri", "Langsuan", "Wireless"],
  "phaya-thai": ["Ari", "Saphan Khwai", "Victory Monument", "Sanam Pao"],
  "huai-khwang": ["Rama 9", "Ratchada", "Thailand Cultural Centre", "Sutthisan"],
  "din-daeng": ["Sutthisan", "Pracha Songkhram", "Ratchaprarop"],
  ratchathewi: ["Pratunam", "Phaya Thai BTS", "Ratchaprarop", "Makkasan"],
  chatuchak: ["Mo Chit", "Ratchayothin", "Sena Nikhom", "Phahon Yothin", "Lat Phrao Intersection"],
  "phra-khanong": ["On Nut", "Punnawithi", "Sukhumvit 71"],
  "suan-luang": ["Phatthanakan", "Srinakarin", "Sukhumvit 77"],
  "bang-na": ["Udom Suk", "Bangna-Trad", "Bang Na BTS"],
  "lat-phrao": ["Chokchai 4", "Lat Phrao 71", "Wang Hin"],
  "wang-thonglang": ["Ramkhamhaeng", "Lat Phrao 101", "Town in Town"],
  "wang-thong-lang": ["Ramkhamhaeng", "Lat Phrao 101", "Town in Town"],
  "bang-sue": ["Bang Sue Grand Station", "Tao Poon", "Wong Sawang"],
  "thon-buri": ["Wongwian Yai", "Krung Thon Buri", "Talat Phlu"],
  "khlong-san": ["Charoen Nakhon", "ICONSIAM", "Krung Thon Buri"],
  "bang-kho-laem": ["Rama 3", "Chan Road", "Charoen Krung"],
  "yan-nawa": ["Rama 3", "Sathu Pradit", "Narathiwat"],
  "bang-kapi": ["Ramkhamhaeng", "Hua Mak", "Lam Sali"],
  prawet: ["On Nut", "Srinakarin", "Phatthanakan"],
  "phasi-charoen": ["Phetkasem", "Bang Wa"],
  "bang-khae": ["Phetkasem", "Bang Khae MRT"],
  "bang-phlat": ["Sirindhorn", "Bang Yi Khan", "Pinklao"],
  "bangkok-noi": ["Pinklao", "Siriraj", "Charansanitwong"],
  "bangkok-yai": ["Tha Phra", "Charansanitwong"],
  dusit: ["Kiak Kai", "Ratchawat", "Samsen"],
  "phra-nakhon": ["Old Town", "Rattanakosin", "Khao San"],
  samphanthawong: ["Chinatown", "Yaowarat", "Hua Lamphong"],
  "pom-prap-sattru-phai": ["Hua Lamphong", "Worachak", "Lan Luang"],
  "rat-burana": ["Suksawat", "Pracha Uthit", "Rama 3 Bridge"],
  "thung-khru": ["Pracha Uthit", "Suksawat"],
  "bang-khun-thian": ["Rama 2", "Bang Khun Thian Beach"],
  "chom-thong": ["Rama 2", "Ekkachai", "Wutthakat"],
  "bang-bon": ["Ekkachai", "Kanchanaphisek"],
  "taling-chan": ["Borommaratchachonnani", "Sai Tai"],
  "thawi-watthana": ["Phutthamonthon Sai 2", "Borommaratchachonnani"],
  "bang-khen": ["Ram Inthra", "Kasetsart", "Lat Pla Khao"],
  "lak-si": ["Chaengwattana", "Lak Si Station", "Government Complex"],
  "don-mueang": ["Don Mueang Airport", "Songprapha", "Vibhavadi"],
  "bueng-kum": ["Nawamin", "Kaset-Nawamin", "Serithai"],
  "khan-na-yao": ["Fashion Island", "Ram Inthra", "Kanchanaphisek"],
  "min-buri": ["Min Buri", "Ram Inthra", "Pink Line"],
  "lat-krabang": ["Suvarnabhumi", "Airport Rail Link", "Chalong Krung"],
  "saphan-sung": ["Ramkhamhaeng 2", "Rat Phatthana"],
  // Phuket
  thalang: ["Laguna", "Bang Tao", "Cherng Talay", "Surin Beach", "Layan", "Nai Yang", "Mai Khao"],
  kathu: ["Patong", "Kamala", "Kathu Town"],
  "mueang-phuket": ["Rawai", "Nai Harn", "Chalong", "Kata", "Karon", "Cape Panwa"],
  "phuket-town": ["Phuket Old Town", "Koh Kaew", "Rassada"],
  // Pattaya / Chon Buri
  pattaya: ["Jomtien", "Pratumnak", "Wongamat", "Naklua", "Central Pattaya"],
  jomtien: ["Jomtien Beach", "Na Jomtien", "Thappraya"],
  pratumnak: ["Pratumnak Hill", "Cosy Beach"],
  "north-pattaya": ["Wongamat", "Naklua"],
  "central-pattaya": ["Pattaya Klang", "Second Road", "Beach Road"],
  "south-pattaya": ["Walking Street", "Thepprasit"],
  "east-pattaya": ["Mabprachan", "Siam Country Club"],
  "huay-yai": ["Huay Yai", "Baan Amphur"],
  "bang-lamung": ["Naklua", "Wongamat"],
  sattahip: ["Bang Saray", "Na Jomtien"],
  "si-racha": ["Sriracha", "Laem Chabang"],
  "mueang-chon-buri": ["Bang Saen", "Ang Sila", "Chonburi City"],
  // Chiang Mai
  "mueang-chiang-mai": ["Nimman", "Santitham", "Old City", "Chang Khlan", "Night Bazaar", "Chang Phueak"],
  "hang-dong": ["Hang Dong", "Kad Farang", "Canal Road"],
  "san-sai": ["San Sai", "Mae Jo", "Kad Ruamchok"],
  saraphi: ["Saraphi", "Chiang Mai-Lamphun Road"],
  "mae-rim": ["Mae Rim", "Mae Sa"],
  // Hua Hin
  "hua-hin": ["Hua Hin Beach", "Khao Takiab", "Hua Hin Soi 94", "Nong Kae"],
  "cha-am": ["Cha-am Beach"],
  "pran-buri": ["Pak Nam Pran", "Khao Kalok"],
  // Samui / Phangan
  "ko-samui": ["Chaweng", "Lamai", "Bophut", "Bang Rak", "Maenam", "Choeng Mon"],
  "koh-samui": ["Chaweng", "Lamai", "Bophut", "Bang Rak", "Maenam", "Choeng Mon"],
  "ko-phangan": ["Thong Sala", "Haad Rin", "Sri Thanu"],
  "koh-phangan": ["Thong Sala", "Haad Rin", "Sri Thanu"],
  // Krabi
  "mueang-krabi": ["Ao Nang", "Krabi Town", "Klong Muang"],
  "ko-lanta": ["Klong Dao", "Long Beach"],
  // Greater Bangkok
  "mueang-samut-prakan": ["Bearing", "Samrong", "Pak Nam", "Srinakarin"],
  "bang-phli": ["Mega Bangna", "Bang Kaeo", "Suvarnabhumi"],
  "phra-pradaeng": ["Bang Krachao", "Suksawat"],
  "mueang-nonthaburi": ["Rattanathibet", "Tiwanon", "Ngamwongwan", "Sanambinnam"],
  "pak-kret": ["Chaengwattana", "Muang Thong Thani", "Impact Arena"],
  "bang-bua-thong": ["Bang Phlu", "Kanchanaphisek"],
  "bang-yai": ["Central WestGate", "Bang Yai Station"],
  "bang-kruai": ["Rama 5", "Phra Nang Klao"],
  thanyaburi: ["Rangsit", "Future Park"],
  "khlong-luang": ["Thammasat Rangsit", "Khlong Luang", "Talad Thai"],
  "lam-luk-ka": ["Lam Luk Ka", "Lam Sam Kaeo"],
  // Rayong
  "mueang-rayong": ["Rayong Beach", "Mae Ramphueng"],
  "ban-chang": ["U-Tapao", "Ban Chang"],
};

const DISTRICT_AKA_TH: Record<string, string[]> = {
  vadhana: ["ทองหล่อ", "เอกมัย", "พร้อมพงษ์", "อโศก"],
  "khlong-toei": ["อโศก", "พระราม 4", "ศูนย์สิริกิติ์"],
  sathon: ["สาทร", "ช่องนนทรี", "สุรศักดิ์"],
  "bang-rak": ["สีลม", "เจริญกรุง", "สุรวงศ์"],
  "pathum-wan": ["สยาม", "ชิดลม", "เพลินจิต", "ราชดำริ", "หลังสวน"],
  "phaya-thai": ["อารีย์", "สะพานควาย", "อนุสาวรีย์ชัย"],
  "huai-khwang": ["พระราม 9", "รัชดา", "สุทธิสาร"],
  "din-daeng": ["สุทธิสาร", "ประชาสงเคราะห์", "ราชปรารภ"],
  ratchathewi: ["ประตูน้ำ", "ราชปรารภ", "มักกะสัน"],
  chatuchak: ["หมอชิต", "รัชโยธิน", "เสนานิคม", "พหลโยธิน"],
  "phra-khanong": ["อ่อนนุช", "ปุณณวิถี", "สุขุมวิท 71"],
  "suan-luang": ["พัฒนาการ", "ศรีนครินทร์", "สุขุมวิท 77"],
  "bang-na": ["อุดมสุข", "บางนา-ตราด"],
  "lat-phrao": ["โชคชัย 4", "ลาดพร้าว 71", "วังหิน"],
  "bang-sue": ["สถานีกลางบางซื่อ", "เตาปูน", "วงศ์สว่าง"],
  "thon-buri": ["วงเวียนใหญ่", "กรุงธนบุรี", "ตลาดพลู"],
  "khlong-san": ["เจริญนคร", "ไอคอนสยาม", "กรุงธนบุรี"],
  "yan-nawa": ["พระราม 3", "สาธุประดิษฐ์", "นราธิวาส"],
  "bang-kho-laem": ["พระราม 3", "ถนนจันทน์", "เจริญกรุง"],
  "bang-kapi": ["รามคำแหง", "หัวหมาก", "ลำสาลี"],
  prawet: ["อ่อนนุช", "ศรีนครินทร์", "พัฒนาการ"],
  "bang-phlat": ["สิรินธร", "บางยี่ขัน", "ปิ่นเกล้า"],
  "bangkok-noi": ["ปิ่นเกล้า", "ศิริราช", "จรัญสนิทวงศ์"],
  samphanthawong: ["เยาวราช", "หัวลำโพง"],
  "bang-khen": ["รามอินทรา", "เกษตร", "ลาดปลาเค้า"],
  "lak-si": ["แจ้งวัฒนะ", "หลักสี่"],
  "lat-krabang": ["สุวรรณภูมิ", "แอร์พอร์ตลิงก์", "ฉลองกรุง"],
  thalang: ["ลากูน่า", "บางเทา", "เชิงทะเล", "สุรินทร์", "ลายัน"],
  kathu: ["ป่าตอง", "กมลา", "กะทู้"],
  "mueang-phuket": ["ราไวย์", "ในหาน", "ฉลอง", "กะตะ", "กะรน", "แหลมพันวา"],
  "phuket-town": ["เมืองเก่าภูเก็ต", "เกาะแก้ว", "รัษฎา"],
  pattaya: ["จอมเทียน", "พระตำหนัก", "วงศ์อมาตย์", "นาเกลือ"],
  jomtien: ["หาดจอมเทียน", "นาจอมเทียน", "เทพประสิทธิ์"],
  pratumnak: ["เขาพระตำหนัก"],
  "north-pattaya": ["วงศ์อมาตย์", "นาเกลือ"],
  "si-racha": ["ศรีราชา", "แหลมฉบัง"],
  "mueang-chon-buri": ["บางแสน", "อ่างศิลา"],
  "mueang-chiang-mai": ["นิมมาน", "สันติธรรม", "เมืองเก่า", "ช้างคลาน", "ไนท์บาซาร์"],
  "hua-hin": ["หาดหัวหิน", "เขาตะเกียบ", "หัวหิน ซอย 94", "หนองแก"],
  "ko-samui": ["เฉวง", "ละไม", "บ่อผุด", "บางรัก", "แม่น้ำ"],
  "koh-samui": ["เฉวง", "ละไม", "บ่อผุด", "บางรัก", "แม่น้ำ"],
  "mueang-krabi": ["อ่าวนาง", "เมืองกระบี่", "คลองม่วง"],
  "mueang-samut-prakan": ["แบริ่ง", "สำโรง", "ปากน้ำ", "ศรีนครินทร์"],
  "bang-phli": ["เมกาบางนา", "บางแก้ว"],
  "mueang-nonthaburi": ["รัตนาธิเบศร์", "ติวานนท์", "งามวงศ์วาน"],
  "pak-kret": ["แจ้งวัฒนะ", "เมืองทองธานี"],
  thanyaburi: ["รังสิต", "ฟิวเจอร์พาร์ค"],
};

const DISTRICT_AKA_KO: Record<string, string[]> = {
  vadhana: ["통로", "에까마이", "프롬퐁", "아속"],
  "khlong-toei": ["아속", "라마 4", "퀸시리킷"],
  sathon: ["사톤", "청논시", "수라삭"],
  "bang-rak": ["실롬", "짜런끄룽", "사판딱신"],
  "pathum-wan": ["시암", "칫롬", "플런칫", "랏차담리", "랑수안"],
  "phaya-thai": ["아리", "사판콰이", "전승기념탑"],
  "huai-khwang": ["라마 9", "랏차다", "타일랜드 컬처럴 센터"],
  "din-daeng": ["수티산", "딘댕"],
  ratchathewi: ["프라투남", "파야타이역", "랏차프라롭"],
  chatuchak: ["머칫", "랏차요틴", "세나니콤"],
  "phra-khanong": ["온눗", "푼나위티"],
  "suan-luang": ["팟타나칸", "시나카린", "수쿰윗 77"],
  "bang-na": ["우돔숙", "방나-뜨랏"],
  "lat-phrao": ["촉차이 4", "랏프라오"],
  "bang-sue": ["방쓰 중앙역", "따오뿐"],
  "thon-buri": ["웡위안야이", "끄룽톤부리"],
  "khlong-san": ["짜런나콘", "아이콘시암"],
  "yan-nawa": ["라마 3", "사투프라딧"],
  "bang-kho-laem": ["라마 3", "짠 로드"],
  "bang-kapi": ["람캄행", "후아막"],
  thalang: ["라구나", "방타오", "청탈레", "수린 비치", "라얀"],
  kathu: ["파통", "카말라", "카투"],
  "mueang-phuket": ["라와이", "나이한", "찰롱", "까따", "까론", "케이프 판와"],
  "phuket-town": ["푸켓 올드타운", "꼬깨우"],
  pattaya: ["좀티엔", "프라탐낙", "웡아맛", "나끌루아"],
  jomtien: ["좀티엔 비치", "나좀티엔"],
  pratumnak: ["프라탐낙 힐"],
  "north-pattaya": ["웡아맛", "나끌루아"],
  "si-racha": ["시라차", "램차방"],
  "mueang-chiang-mai": ["님만", "산티탐", "올드시티", "창클란", "나이트바자"],
  "hua-hin": ["후아힌 비치", "카오따끼얍", "후아힌 소이 94"],
  "ko-samui": ["차웽", "라마이", "보풋", "방락", "매남"],
  "koh-samui": ["차웽", "라마이", "보풋", "방락", "매남"],
  "mueang-krabi": ["아오낭", "끄라비 타운"],
  "mueang-samut-prakan": ["베어링", "삼롱", "빡남"],
  "bang-phli": ["메가방나", "방깨우"],
  "mueang-nonthaburi": ["랏따나티벳", "띠와논", "응암웡완"],
  "pak-kret": ["쨍왓타나", "므앙통타니"],
  thanyaburi: ["랑싯", "퓨처파크"],
};

/** Sub-areas to print for a district, in the reader's language where we
 *  have them. Empty for districts with nothing better known than the khet
 *  name itself. */
export function districtAka(slug: string | null | undefined, lang: "en" | "ko" | "th" = "en"): string[] {
  if (!slug) return [];
  const key = slug.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (lang === "th") return DISTRICT_AKA_TH[key] ?? DISTRICT_AKA[key] ?? [];
  if (lang === "ko") return DISTRICT_AKA_KO[key] ?? DISTRICT_AKA[key] ?? [];
  return DISTRICT_AKA[key] ?? [];
}

/** Human-readable, localised label for a raw DB `province` value.
 *
 *  Callers used to title-case the raw column inline
 *  (`province.replace(/-/g, " ").replace(/\b\w/g, …)`), which only reads well
 *  for the kebab spellings. The compact spellings this codebase treats as
 *  canonical render badly that way — "chiangmai" becomes "Chiangmai", not
 *  "Chiang Mai" — and the normalisation pass in
 *  scripts/normalize_regions_and_provinces.py collapses every province onto
 *  exactly those compact forms, so the inline version would have regressed
 *  five cities at once. Going through CITIES also means the label is
 *  translated instead of being English on /ko and /th.
 *
 *  Provinces with no city page (surat-thani, prachuap-khiri-khan, …) keep the
 *  old title-cased fallback. */
export function provinceDisplayName(
  dbProvince: string | null | undefined,
  lang: "en" | "ko" | "th" = "en",
): string {
  if (!dbProvince) return "";
  const city = getCity(dbProvince);
  if (city) return city.name[lang];
  return dbProvince.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
