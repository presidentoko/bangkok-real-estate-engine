// Non-Bangkok cities currently in the DB (province column on `condos`).
// Each entry drives a /[lang]/city/[slug] landing page when published.

export type CitySlug = "pattaya" | "chonburi" | "huahin" | "phuket" | "chiangmai";

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
];

export function getCity(slug: string): City | null {
  return CITIES.find((c) => c.slug === slug) ?? null;
}

export const CITY_SLUGS = CITIES.map((c) => c.slug);
