// web/lib/tenNumbers.ts
// Copy for /[lang]/insights/bangkok-condo-market-10-numbers.
//
// These are FIXED, dated snapshot values (asking prices, measured
// 2026-11-17), not live queries: the page is meant to be quoted, so a figure
// on it must not change under a journalist's link, and it must cost zero
// database reads. Source of truth: data/outreach/stats-reverify-2026-11-17.md
// in the outreach workspace ("Now (2026-11-17)" column). The live pages each
// item links to show the current figure, which may since have moved.
//
// Dependency-free on purpose so tenNumbers.test.ts runs under plain
// `node --test`.

export type TenNumbersLang = "en" | "ko" | "th";

export const TEN_NUMBERS_PATH = "/insights/bangkok-condo-market-10-numbers";
export const TEN_NUMBERS_PUBLISHED = "2026-11-22";
export const TEN_NUMBERS_MEASURED = "2026-11-17";

/** Live page that shows the current figure, as a path without the lang prefix. */
type LiveLink = "/flood" | "/yield/bangkok" | "/near" | "/guide/foreign-quota" | "/data" | "/fees/bangkok";

export type Finding = {
  /** The headline number, identical in every language. */
  figure: string;
  title: string;
  body: string;
  sample: string;
  link: LiveLink | null;
  linkLabel: string | null;
};

export type TenNumbersCopy = {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  lead: string;
  measuredLine: string;
  sampleLabel: string;
  findings: Finding[];
  methodTitle: string;
  method: string[];
  citeTitle: string;
  citeBody: string;
  /** One line used by /data and /press to link here. */
  inboundLink: string;
};

/** The citation string stays in English in every language, so quotes match. */
export const TEN_NUMBERS_CITATION =
  "RealData (passionaryestate.com), Bangkok condo market in 10 numbers, November 2026";

const en: TenNumbersCopy = {
  metaTitle: "Bangkok Condo Market in 10 Numbers (Nov 2026) | RealData",
  metaDescription:
    "Ten dated figures on Bangkok condos: 5.4% median gross yield, flood-risk districts yield 6.2% vs 4.2%, station premium about 45%, fees 4.6x apart. Asking prices, measured 2026-11-17.",
  h1: "Bangkok condo market in 10 numbers (November 2026)",
  eyebrow: "RealData insights",
  lead:
    "Ten figures from our own measurement of Bangkok condo listings across four portals. Each one is a fixed snapshot with its sample size, so it can be quoted and checked. Where a live page shows the current figure, it is linked.",
  measuredLine: "Asking prices and asking rents, measured 2026-11-17. Published 2026-11-22.",
  sampleLabel: "Sample",
  findings: [
    {
      figure: "6.2% vs 4.2%",
      title: "The most flood-prone districts have the highest yields",
      body:
        "The median gross yield is 6.2% in Bangkok's highest flood-risk districts (level 5) and 4.2% in the lowest (level 1), and it rises at every level in between: 5.4%, 5.6%, 5.8%.",
      sample: "43 buildings at level 5, 75 at level 1",
      link: "/flood",
      linkLabel: "Bangkok flood map by district",
    },
    {
      figure: "23%",
      title: "Almost a quarter of buildings would land in the wrong district",
      body:
        "295 of 1,296 Hipflat Bangkok buildings fall in the wrong district if placed by project name or listing text. We place every building by its map coordinates against district boundaries.",
      sample: "1,296 Hipflat Bangkok buildings; one-off check during the 2026-11-10 repair",
      link: null,
      linkLabel: null,
    },
    {
      figure: "5.4%",
      title: "Bangkok's median gross yield",
      body:
        "The median Bangkok condo yields 5.4% gross (middle half 4.3–6.5%), 1.7 points below the 7.10% bank mortgage rate (MRR, a Bank of Thailand figure as of July 2025). 151 of 881 buildings (17%) yield 7.10% or more, before vacancy, fees and tax.",
      sample: "881 buildings",
      link: "/yield/bangkok",
      linkLabel: "Bangkok rental yield (live)",
    },
    {
      figure: "+45%",
      title: "Near a station costs more, but does not yield more",
      body:
        "A condo within 300 m of a BTS or MRT station asks about 45% more per square metre than one 1–2 km away (USD 3,054 vs USD 2,111), yet the gross yield is about the same, 5.2–5.6%.",
      sample: "112 buildings within 300 m, 83 at 1–2 km",
      link: "/near",
      linkLabel: "Condos by BTS and MRT station",
    },
    {
      figure: "2x",
      title: "New buildings ask about twice as much as old ones",
      body:
        "Buildings completed in 2021 or later ask about twice as much per square metre as pre-2001 buildings in the same district: +32% vs −33% against the district median, or about −2.9% for each year of age.",
      sample: "75 buildings from 2021 or later, 65 from before 2001; 490 in the per-year estimate",
      link: null,
      linkLabel: null,
    },
    {
      figure: "24%",
      title: "A quarter of buildings had only Thai-quota units for sale",
      body:
        "In 299 of 1,231 buildings, every unit listed for sale on FazWaz was Thai-quota. Foreigners may own at most 49% of a condo building's floor area in total; a building with no foreign-quota unit on sale may still have foreign quota left, so this does not prove its quota is full.",
      sample: "1,231 buildings on FazWaz (scans 2026-05-18 to 2026-08-22)",
      link: "/guide/foreign-quota",
      linkLabel: "Foreign quota guide",
    },
    {
      figure: "~4,800",
      title: "No single portal shows the whole market",
      body:
        "About 7,900 Bangkok condo records across four portals (DDproperty, FazWaz, DotProperty, Hipflat) merge to about 4,800 buildings. About 3,400 of them appear on only one portal.",
      sample: "7,895 records, 4,777 buildings, 3,407 on one portal only",
      link: "/data",
      linkLabel: "Our data coverage",
    },
    {
      figure: "6.3% → 4.1%",
      title: "Cheaper condos yield more",
      body:
        "Median gross yield by sale price: under ฿3M 6.3%, ฿3–5M 5.7%, ฿5–10M 5.1%, ฿10M and above 4.1%.",
      sample: "194 buildings under ฿3M, 181 at ฿3–5M, 277 at ฿5–10M, 229 at ฿10M+",
      link: "/yield/bangkok",
      linkLabel: "Bangkok rental yield (live)",
    },
    {
      figure: "4.6x",
      title: "Common fees vary 4.6 times by district",
      body:
        "The median monthly common fee per unit is ฿4,570 in Pathum Wan and ฿986 in Sai Mai, 4.6 times apart. The Bangkok median is ฿2,090.",
      sample: "42 buildings in Pathum Wan, 12 in Sai Mai, 1,169 in Bangkok",
      link: "/fees/bangkok",
      linkLabel: "Bangkok common fees (live)",
    },
    {
      figure: "5.4% vs 8.5%",
      title: "Bangkok has the lowest yield of the big markets",
      body:
        "Median gross yield: Bangkok 5.4%, Pattaya 7.2%, Chiang Mai 7.2%, Phuket 8.5%. The Chiang Mai and Phuket samples are small.",
      sample: "Bangkok 881 buildings, Pattaya 236, Chiang Mai 22, Phuket 29",
      link: "/yield/bangkok",
      linkLabel: "Yield by city (live)",
    },
  ],
  methodTitle: "Method and caveats",
  method: [
    "These are asking prices and asking rents from listing portals, not signed deals or transfer prices.",
    "Gross yield = 12 × median monthly asking rent ÷ median asking sale price, per building. A building counts only with at least 2 sale and 2 rent listings, a sale price of at least ฿500,000, and a yield of at most 25%. Vacancy, fees and tax are not deducted.",
    "Flood level (1 to 5) is a district-wide rating from Bangkok Metropolitan Administration and JICA flood data. It is not a per-building measurement.",
    "All figures were measured on 2026-11-17, except the 23% district check, which records a one-off repair on 2026-11-10. The bank mortgage rate (7.10% MRR) is a Bank of Thailand value as of July 2025.",
  ],
  citeTitle: "How to cite",
  citeBody: "This page may be quoted, in full or in part, with a link back to it. Please cite it as:",
  inboundLink: "Bangkok condo market in 10 numbers (November 2026)",
};

const ko: TenNumbersCopy = {
  metaTitle: "숫자 10개로 보는 방콕 콘도 시장 (2026년 11월) | RealData",
  metaDescription:
    "방콕 콘도에 관한 날짜가 명시된 수치 10개: 중위 총수익률 5.4%, 침수 위험 지역 6.2% 대 4.2%, 역세권 프리미엄 약 45%, 관리비 4.6배 차이. 호가 기준, 2026-11-17 측정.",
  h1: "숫자 10개로 보는 방콕 콘도 시장 (2026년 11월)",
  eyebrow: "RealData 인사이트",
  lead:
    "4개 포털의 방콕 콘도 매물을 직접 측정해 얻은 수치 10개입니다. 각 수치는 표본 수와 함께 고정된 스냅샷이라 인용하고 검증할 수 있습니다. 현재 수치를 보여주는 라이브 페이지가 있으면 링크했습니다.",
  measuredLine: "매매 호가와 임대 호가 기준, 2026-11-17 측정. 2026-11-22 게시.",
  sampleLabel: "표본",
  findings: [
    {
      figure: "6.2% vs 4.2%",
      title: "침수 위험이 가장 큰 지역의 수익률이 가장 높다",
      body:
        "방콕에서 침수 위험이 가장 높은 구(5등급)의 중위 총수익률은 6.2%, 가장 낮은 구(1등급)는 4.2%이며, 그 사이 등급에서도 5.4%, 5.6%, 5.8%로 단계마다 올라갑니다.",
      sample: "5등급 43개 건물, 1등급 75개 건물",
      link: "/flood",
      linkLabel: "방콕 구별 침수 지도",
    },
    {
      figure: "23%",
      title: "건물 4곳 중 1곳 가까이가 엉뚱한 구로 분류될 뻔했다",
      body:
        "Hipflat 방콕 건물 1,296개 중 295개는 프로젝트 이름이나 매물 문구로 위치를 정하면 다른 구에 들어갑니다. 저희는 모든 건물을 지도 좌표와 구 경계로 배정합니다.",
      sample: "Hipflat 방콕 건물 1,296개, 2026-11-10 보정 때의 1회 점검",
      link: null,
      linkLabel: null,
    },
    {
      figure: "5.4%",
      title: "방콕 중위 총수익률",
      body:
        "방콕 콘도의 중위 총수익률은 5.4%(중간 50%는 4.3–6.5%)로, 은행 주택담보대출 금리 7.10%(MRR, 2025년 7월 기준 태국 중앙은행 수치)보다 1.7%p 낮습니다. 881개 건물 중 151개(17%)가 7.10% 이상이며, 공실·관리비·세금을 빼기 전 수치입니다.",
      sample: "881개 건물",
      link: "/yield/bangkok",
      linkLabel: "방콕 임대 수익률 (실시간)",
    },
    {
      figure: "+45%",
      title: "역 근처는 비싸지만 수익률은 높지 않다",
      body:
        "BTS·MRT 역 300m 이내 콘도는 1–2km 떨어진 콘도보다 제곱미터당 호가가 약 45% 높지만(USD 3,054 대 USD 2,111), 총수익률은 5.2–5.6%로 비슷합니다.",
      sample: "300m 이내 112개 건물, 1–2km 83개 건물",
      link: "/near",
      linkLabel: "BTS·MRT 역별 콘도",
    },
    {
      figure: "2x",
      title: "신축은 구축보다 약 두 배를 부른다",
      body:
        "2021년 이후 준공 건물은 같은 구의 2001년 이전 건물보다 제곱미터당 호가가 약 두 배입니다. 구 중위값 대비 +32%와 −33%이며, 건물 연식 1년당 약 −2.9%입니다.",
      sample: "2021년 이후 75개, 2001년 이전 65개 건물. 연간 추정에는 490개",
      link: null,
      linkLabel: null,
    },
    {
      figure: "24%",
      title: "건물 4곳 중 1곳은 매물이 전부 태국인 쿼터였다",
      body:
        "1,231개 건물 중 299개에서 FazWaz에 매물로 나온 모든 호실이 태국인 쿼터였습니다. 외국인은 한 콘도 건물 전체 면적의 최대 49%까지만 소유할 수 있습니다. 외국인 쿼터 매물이 없다고 해서 건물의 외국인 쿼터가 소진됐다는 뜻은 아닙니다.",
      sample: "FazWaz 1,231개 건물 (2026-05-18 ~ 2026-08-22 수집)",
      link: "/guide/foreign-quota",
      linkLabel: "외국인 쿼터 가이드",
    },
    {
      figure: "~4,800",
      title: "어느 포털 하나로는 시장 전체가 보이지 않는다",
      body:
        "4개 포털(DDproperty, FazWaz, DotProperty, Hipflat)의 방콕 콘도 기록 약 7,900건은 중복을 합치면 약 4,800개 건물입니다. 그중 약 3,400개는 한 포털에만 나옵니다.",
      sample: "기록 7,895건, 건물 4,777개, 한 포털에만 3,407개",
      link: "/data",
      linkLabel: "데이터 범위",
    },
    {
      figure: "6.3% → 4.1%",
      title: "싼 콘도일수록 수익률이 높다",
      body:
        "매매가 구간별 중위 총수익률: ฿3M 미만 6.3%, ฿3–5M 5.7%, ฿5–10M 5.1%, ฿10M 이상 4.1%.",
      sample: "฿3M 미만 194개, ฿3–5M 181개, ฿5–10M 277개, ฿10M 이상 229개 건물",
      link: "/yield/bangkok",
      linkLabel: "방콕 임대 수익률 (실시간)",
    },
    {
      figure: "4.6x",
      title: "관리비는 구에 따라 4.6배 차이 난다",
      body:
        "호실당 월 관리비 중위값은 빠툼완 ฿4,570, 사이마이 ฿986으로 4.6배 차이입니다. 방콕 전체 중위값은 ฿2,090입니다.",
      sample: "빠툼완 42개, 사이마이 12개, 방콕 1,169개 건물",
      link: "/fees/bangkok",
      linkLabel: "방콕 관리비 (실시간)",
    },
    {
      figure: "5.4% vs 8.5%",
      title: "주요 시장 중 방콕의 수익률이 가장 낮다",
      body:
        "중위 총수익률: 방콕 5.4%, 파타야 7.2%, 치앙마이 7.2%, 푸껫 8.5%. 치앙마이와 푸껫은 표본이 작습니다.",
      sample: "방콕 881개, 파타야 236개, 치앙마이 22개, 푸껫 29개 건물",
      link: "/yield/bangkok",
      linkLabel: "도시별 수익률 (실시간)",
    },
  ],
  methodTitle: "측정 방법과 한계",
  method: [
    "모두 매물 포털의 매매 호가와 임대 호가이며, 실제 계약가나 등기 가격이 아닙니다.",
    "총수익률 = 12 × 월 임대 호가 중위값 ÷ 매매 호가 중위값 (건물별). 매매 매물 2개 이상, 임대 매물 2개 이상, 매매가 ฿500,000 이상, 수익률 25% 이하인 건물만 포함합니다. 공실, 관리비, 세금은 빼지 않았습니다.",
    "침수 등급(1–5)은 방콕시청(BMA)과 JICA 침수 자료에 따른 구 단위 등급이며, 건물별 측정이 아닙니다.",
    "모든 수치는 2026-11-17에 측정했습니다. 단, 23% 수치는 2026-11-10의 1회 보정 기록입니다. 은행 주택담보대출 금리(MRR 7.10%)는 2025년 7월 기준 태국 중앙은행 수치입니다.",
  ],
  citeTitle: "인용 방법",
  citeBody: "이 페이지는 링크를 함께 걸면 전체 또는 일부를 인용할 수 있습니다. 다음과 같이 인용해 주세요:",
  inboundLink: "숫자 10개로 보는 방콕 콘도 시장 (2026년 11월)",
};

const th: TenNumbersCopy = {
  metaTitle: "ตลาดคอนโดกรุงเทพฯ ใน 10 ตัวเลข (พ.ย. 2026) | RealData",
  metaDescription:
    "10 ตัวเลขคอนโดกรุงเทพฯ ที่ระบุวันที่: ผลตอบแทนค่าเช่าขั้นต้นมัธยฐาน 5.4% เขตเสี่ยงน้ำท่วม 6.2% เทียบ 4.2% ใกล้สถานีแพงขึ้นราว 45% ค่าส่วนกลางต่างกัน 4.6 เท่า ราคาประกาศ วัดเมื่อ 2026-11-17",
  h1: "ตลาดคอนโดกรุงเทพฯ ใน 10 ตัวเลข (พฤศจิกายน 2026)",
  eyebrow: "RealData insights",
  lead:
    "10 ตัวเลขจากการวัดประกาศขายและเช่าคอนโดกรุงเทพฯ บน 4 พอร์ทัลด้วยตัวเราเอง แต่ละตัวเลขเป็นภาพ ณ วันที่กำหนดพร้อมขนาดตัวอย่าง จึงอ้างอิงและตรวจสอบได้ หากมีหน้าเว็บที่แสดงตัวเลขปัจจุบัน เราได้ใส่ลิงก์ไว้",
  measuredLine: "ราคาขายและค่าเช่าที่ประกาศ วัดเมื่อ 2026-11-17 เผยแพร่ 2026-11-22",
  sampleLabel: "ตัวอย่าง",
  findings: [
    {
      figure: "6.2% vs 4.2%",
      title: "เขตที่เสี่ยงน้ำท่วมที่สุดให้ผลตอบแทนสูงที่สุด",
      body:
        "ผลตอบแทนค่าเช่าขั้นต้นมัธยฐานอยู่ที่ 6.2% ในเขตที่เสี่ยงน้ำท่วมสูงสุดของกรุงเทพฯ (ระดับ 5) และ 4.2% ในเขตที่เสี่ยงต่ำสุด (ระดับ 1) และเพิ่มขึ้นทุกระดับในระหว่างนั้น: 5.4%, 5.6%, 5.8%",
      sample: "ระดับ 5: 43 อาคาร, ระดับ 1: 75 อาคาร",
      link: "/flood",
      linkLabel: "แผนที่น้ำท่วมกรุงเทพฯ รายเขต",
    },
    {
      figure: "23%",
      title: "เกือบหนึ่งในสี่ของอาคารจะถูกจัดผิดเขต",
      body:
        "อาคารกรุงเทพฯ บน Hipflat 295 จาก 1,296 แห่งจะอยู่ผิดเขต หากระบุตำแหน่งจากชื่อโครงการหรือข้อความในประกาศ เราจัดทุกอาคารตามพิกัดแผนที่เทียบกับขอบเขตเขต",
      sample: "อาคารกรุงเทพฯ บน Hipflat 1,296 แห่ง ตรวจครั้งเดียวระหว่างการแก้ไขวันที่ 2026-11-10",
      link: null,
      linkLabel: null,
    },
    {
      figure: "5.4%",
      title: "ผลตอบแทนค่าเช่าขั้นต้นมัธยฐานของกรุงเทพฯ",
      body:
        "คอนโดกรุงเทพฯ มีผลตอบแทนขั้นต้นมัธยฐาน 5.4% (ครึ่งกลางอยู่ที่ 4.3–6.5%) ต่ำกว่าอัตราดอกเบี้ยเงินกู้บ้าน 7.10% (MRR ตัวเลขธนาคารแห่งประเทศไทย ณ กรกฎาคม 2025) อยู่ 1.7 จุด อาคาร 151 จาก 881 แห่ง (17%) ให้ผลตอบแทน 7.10% ขึ้นไป ก่อนหักห้องว่าง ค่าส่วนกลาง และภาษี",
      sample: "881 อาคาร",
      link: "/yield/bangkok",
      linkLabel: "ผลตอบแทนค่าเช่ากรุงเทพฯ (ข้อมูลล่าสุด)",
    },
    {
      figure: "+45%",
      title: "ใกล้สถานีแพงกว่า แต่ผลตอบแทนไม่สูงกว่า",
      body:
        "คอนโดในระยะ 300 ม. จากสถานี BTS หรือ MRT ตั้งราคาต่อตารางเมตรสูงกว่าคอนโดที่ห่าง 1–2 กม. ราว 45% (USD 3,054 เทียบ USD 2,111) แต่ผลตอบแทนขั้นต้นใกล้เคียงกันที่ 5.2–5.6%",
      sample: "ในระยะ 300 ม. 112 อาคาร, ระยะ 1–2 กม. 83 อาคาร",
      link: "/near",
      linkLabel: "คอนโดตามสถานี BTS และ MRT",
    },
    {
      figure: "2x",
      title: "อาคารใหม่ตั้งราคาราวสองเท่าของอาคารเก่า",
      body:
        "อาคารที่สร้างเสร็จตั้งแต่ปี 2021 ตั้งราคาต่อตารางเมตรราวสองเท่าของอาคารก่อนปี 2001 ในเขตเดียวกัน: +32% เทียบ −33% เมื่อเทียบกับมัธยฐานของเขต หรือประมาณ −2.9% ต่ออายุอาคารหนึ่งปี",
      sample: "อาคารตั้งแต่ปี 2021 จำนวน 75 แห่ง, ก่อนปี 2001 จำนวน 65 แห่ง; ค่าประมาณรายปีใช้ 490 แห่ง",
      link: null,
      linkLabel: null,
    },
    {
      figure: "24%",
      title: "หนึ่งในสี่ของอาคารมีแต่ห้องโควตาไทยประกาศขาย",
      body:
        "ใน 299 จาก 1,231 อาคาร ทุกห้องที่ประกาศขายบน FazWaz เป็นโควตาไทย กฎหมายให้ชาวต่างชาติถือครองได้รวมไม่เกิน 49% ของพื้นที่ห้องชุดทั้งอาคาร อาคารที่ไม่มีห้องโควตาต่างชาติประกาศขายอาจยังมีโควตาต่างชาติเหลืออยู่ จึงไม่ได้พิสูจน์ว่าโควตาเต็ม",
      sample: "1,231 อาคารบน FazWaz (เก็บข้อมูล 2026-05-18 ถึง 2026-08-22)",
      link: "/guide/foreign-quota",
      linkLabel: "คู่มือโควตาต่างชาติ",
    },
    {
      figure: "~4,800",
      title: "ไม่มีพอร์ทัลใดแสดงตลาดได้ทั้งหมด",
      body:
        "ข้อมูลคอนโดกรุงเทพฯ ราว 7,900 รายการจาก 4 พอร์ทัล (DDproperty, FazWaz, DotProperty, Hipflat) รวมรายการซ้ำแล้วเหลือราว 4,800 อาคาร ในจำนวนนี้ราว 3,400 อาคารปรากฏบนพอร์ทัลเดียวเท่านั้น",
      sample: "7,895 รายการ, 4,777 อาคาร, 3,407 อาคารอยู่บนพอร์ทัลเดียว",
      link: "/data",
      linkLabel: "ขอบเขตข้อมูลของเรา",
    },
    {
      figure: "6.3% → 4.1%",
      title: "คอนโดราคาถูกให้ผลตอบแทนสูงกว่า",
      body:
        "ผลตอบแทนขั้นต้นมัธยฐานตามช่วงราคาขาย: ต่ำกว่า ฿3M 6.3%, ฿3–5M 5.7%, ฿5–10M 5.1%, ฿10M ขึ้นไป 4.1%",
      sample: "ต่ำกว่า ฿3M 194 อาคาร, ฿3–5M 181, ฿5–10M 277, ฿10M ขึ้นไป 229",
      link: "/yield/bangkok",
      linkLabel: "ผลตอบแทนค่าเช่ากรุงเทพฯ (ข้อมูลล่าสุด)",
    },
    {
      figure: "4.6x",
      title: "ค่าส่วนกลางต่างกัน 4.6 เท่าตามเขต",
      body:
        "ค่าส่วนกลางรายเดือนมัธยฐานต่อห้องอยู่ที่ ฿4,570 ในเขตปทุมวัน และ ฿986 ในเขตสายไหม ต่างกัน 4.6 เท่า มัธยฐานทั้งกรุงเทพฯ อยู่ที่ ฿2,090",
      sample: "ปทุมวัน 42 อาคาร, สายไหม 12, กรุงเทพฯ 1,169",
      link: "/fees/bangkok",
      linkLabel: "ค่าส่วนกลางกรุงเทพฯ (ข้อมูลล่าสุด)",
    },
    {
      figure: "5.4% vs 8.5%",
      title: "กรุงเทพฯ ให้ผลตอบแทนต่ำที่สุดในตลาดใหญ่",
      body:
        "ผลตอบแทนขั้นต้นมัธยฐาน: กรุงเทพฯ 5.4%, พัทยา 7.2%, เชียงใหม่ 7.2%, ภูเก็ต 8.5% ตัวอย่างของเชียงใหม่และภูเก็ตมีขนาดเล็ก",
      sample: "กรุงเทพฯ 881 อาคาร, พัทยา 236, เชียงใหม่ 22, ภูเก็ต 29",
      link: "/yield/bangkok",
      linkLabel: "ผลตอบแทนรายเมือง (ข้อมูลล่าสุด)",
    },
  ],
  methodTitle: "วิธีการและข้อจำกัด",
  method: [
    "ตัวเลขทั้งหมดเป็นราคาขายและค่าเช่าที่ประกาศบนพอร์ทัล ไม่ใช่ราคาซื้อขายจริงหรือราคาโอน",
    "ผลตอบแทนขั้นต้น = 12 × ค่าเช่ารายเดือนมัธยฐาน ÷ ราคาขายมัธยฐาน (รายอาคาร) นับเฉพาะอาคารที่มีประกาศขายอย่างน้อย 2 รายการและประกาศเช่าอย่างน้อย 2 รายการ ราคาขายอย่างน้อย ฿500,000 และผลตอบแทนไม่เกิน 25% ไม่ได้หักห้องว่าง ค่าส่วนกลาง หรือภาษี",
    "ระดับน้ำท่วม (1–5) เป็นระดับทั้งเขตจากข้อมูลน้ำท่วมของกรุงเทพมหานคร (กทม.) และ JICA ไม่ใช่การวัดรายอาคาร",
    "ตัวเลขทั้งหมดวัดเมื่อ 2026-11-17 ยกเว้นตัวเลข 23% ซึ่งบันทึกการแก้ไขครั้งเดียวเมื่อ 2026-11-10 อัตราดอกเบี้ยเงินกู้บ้าน (MRR 7.10%) เป็นตัวเลขธนาคารแห่งประเทศไทย ณ กรกฎาคม 2025",
  ],
  citeTitle: "วิธีอ้างอิง",
  citeBody: "อ้างอิงหน้านี้ทั้งหมดหรือบางส่วนได้ โดยใส่ลิงก์กลับมาที่หน้านี้ กรุณาอ้างอิงว่า:",
  inboundLink: "ตลาดคอนโดกรุงเทพฯ ใน 10 ตัวเลข (พฤศจิกายน 2026)",
};

export const TEN_NUMBERS: Record<TenNumbersLang, TenNumbersCopy> = { en, ko, th };
