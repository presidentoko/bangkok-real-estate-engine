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
