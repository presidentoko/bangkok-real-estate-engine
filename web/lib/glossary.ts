// web/lib/glossary.ts
// Static glossary. English is the source text; ko/th live in GLOSSARY_I18N
// below and are merged on read by localizeTerm(). Numbers and structure are
// language-agnostic. Each term anchors internal links and powers DefinedTerm
// JSON-LD -- which is the reason the translations matter: this is the one
// page type on the site whose whole job is to define a term, i.e. exactly
// what an answer engine quotes, and it was English-only until 2026-08-31.

export type GlossaryTerm = {
  slug: string;
  term: string;
  /** One-sentence answer-engine definition (used in DefinedTerm + meta description). */
  definition: string;
  /** How RealData computes/sources it (the differentiator vs generic glossaries). */
  howCalculated: string;
  /** Slugs of other terms to cross-link. */
  related: string[];
};

/** The translatable surface. `related` and `slug` stay on the English
 *  record -- they are identifiers, not copy. */
export type GlossaryCopy = {
  term: string;
  definition: string;
  howCalculated: string;
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "bubble-index",
    term: "Bubble Index",
    definition:
      "RealData's Bubble Index scores a condo's asking price against the median price-per-sqm of its district: 100 is on par, above 100 is overpriced, below 100 is underpriced.",
    howCalculated:
      "We take each building's median sale price-per-sqm from active listings and divide it by the district median, indexed to 100. A reading of 115 means the building asks ~15% above its district; 85 means ~15% below. Stored as value_scores.bubble_index.",
    related: ["price-per-sqm", "super-value"],
  },
  {
    slug: "resale-liquidity",
    term: "Resale Liquidity Score",
    definition:
      "RealData's Resale Liquidity Score (0–100) estimates how easily a unit in a building can be re-sold — higher means buyers are found faster and more of the supply clears.",
    howCalculated:
      "We track every for-sale listing in a building from the day it appears to the day it leaves the market. The score blends how much of recent supply actually cleared (absorption), how fast it cleared, and how long current unsold inventory has been sitting. Buildings with too few tracked listings show no score rather than a misleading one. Stored as value_scores.liquidity_score. It is an availability signal, not a guarantee of sale price.",
    related: ["bubble-index", "days-on-market"],
  },
  {
    slug: "retiree-suitability",
    term: "Retiree Suitability Score",
    definition:
      "RealData's Retiree Suitability Score (0–100) rates how well a building's location suits a retiree, weighting nearby healthcare and clean air ahead of car-free transit and daily errands.",
    howCalculated:
      "We blend healthcare proximity (hospitals/clinics within 1km), air quality (WAQI AQI), distance to the nearest BTS/MRT, and supermarkets within 1km — weighted toward the factors that matter most to Thailand's retirement-visa (O-A/O-X) buyers rather than young investors. Buildings without location data show no score.",
    related: ["livability-score", "flood-risk-level"],
  },
  {
    slug: "gross-yield",
    term: "Gross Rental Yield",
    definition:
      "Gross rental yield is annual rental income as a percentage of purchase price, before costs — a quick gauge of income return on a Bangkok condo.",
    howCalculated:
      "We compute (median monthly rent x 12) / median sale price for the building from active sale and rent listings, expressed as a percentage (condos.gross_yield_pct). Bangkok condos typically run 4–7% gross.",
    related: ["price-per-sqm", "mrr"],
  },
  {
    slug: "price-per-sqm",
    term: "Price per Square Metre",
    definition:
      "Price per square metre normalises condo prices by unit size so buildings of different unit mixes can be compared like-for-like.",
    howCalculated:
      "Median asking sale price divided by interior area across a building's active listings, in THB/sqm. It is the base input to the Bubble Index.",
    related: ["bubble-index", "gross-yield"],
  },
  {
    slug: "flood-risk-level",
    term: "Flood Risk Level (L1–L5)",
    definition:
      "Flood Risk Level rates a location's flooding exposure on a five-step scale, L1 (lowest) to L5 (highest), based on Bangkok's district flood model.",
    howCalculated:
      "Each building inherits the flood level of its district polygon from our Bangkok flood layer (risk_factors.flood_risk_level). Where a per-building score exists it overrides the district value. See the live map on the Flood page.",
    related: ["livability-score", "ground-stability"],
  },
  {
    slug: "developer-track-record",
    term: "Developer Track Record",
    definition:
      "A developer's track record is the scale and history of the projects they have built — a proxy for delivery experience and completion risk, especially on off-plan condos.",
    howCalculated:
      "We read the developer from each building's FazWaz project page and surface their portfolio size (number of projects and total units). A larger book usually means a longer delivery record and lower completion risk, though it is not a guarantee of build quality on any single project. Stored as condos.developer / developer_project_count / developer_unit_count.",
    related: ["resale-liquidity", "bubble-index"],
  },
  {
    slug: "ground-stability",
    term: "Ground Stability (Land Subsidence, L1–L5)",
    definition:
      "Ground Stability rates how much a location is sinking due to land subsidence, on a five-step scale from L1 (very low) to L5 (severe), because Bangkok sits on soft marine clay.",
    howCalculated:
      "We assign each building its district's subsidence level (risk_factors.subsidence_level) from published InSAR and groundwater-monitoring studies. Bangkok sank as fast as ~120mm/year in the 1980s; groundwater regulation cut inner-city rates to near zero, but the eastern soft-clay belt and coastal south keep sinking, which compounds monsoon-flood risk over a 10–20 year horizon. District-level estimate, not a per-building survey.",
    related: ["flood-risk-level"],
  },
  {
    slug: "foreign-quota",
    term: "Foreign Ownership Quota (49%)",
    definition:
      "Thai law lets foreigners collectively own up to 49% of the total saleable floor area of any condominium; the other 51% must be Thai-owned.",
    howCalculated:
      "Set by the Condominium Act B.E. 2522. A building's remaining foreign quota determines whether a foreigner can buy a given unit in freehold. See our foreign-ownership guide.",
    related: ["freehold", "leasehold"],
  },
  {
    slug: "freehold",
    term: "Freehold",
    definition:
      "Freehold means owning a condo unit outright and indefinitely in your own name, registered at the Land Department.",
    howCalculated:
      "Foreigners can hold a condo freehold only within the building's 49% foreign quota, and must remit the purchase funds from abroad in foreign currency (FET form).",
    related: ["foreign-quota", "leasehold"],
  },
  {
    slug: "leasehold",
    term: "Leasehold",
    definition:
      "Leasehold is a registered long-term lease of a property — up to 30 years per term — used by foreigners when freehold is unavailable or for land/villas.",
    howCalculated:
      "Leases are registered at the Land Department for a maximum 30-year term; renewal clauses are contractual, not automatically enforceable. Common when a building's foreign quota is full.",
    related: ["freehold", "foreign-quota"],
  },
  {
    slug: "livability-score",
    term: "Livability Score",
    definition:
      "The Livability Score summarises how convenient a building's location is — proximity to rail transit plus nearby hospitals, schools, and supermarkets.",
    howCalculated:
      "Derived from livability_metrics: distance to the nearest BTS/MRT station and counts of hospitals, schools, and supermarkets within 1 km. Closer transit and denser amenities raise the score.",
    related: ["flood-risk-level"],
  },
  {
    slug: "super-value",
    term: "Super Value",
    definition:
      "A Super Value badge flags a condo our model considers materially underpriced versus comparable buildings in its district.",
    howCalculated:
      "Set when a building's Bubble Index sits well below its district median with enough listing samples to be reliable (value_scores.is_super_value).",
    related: ["bubble-index"],
  },
  {
    slug: "days-on-market",
    term: "Days on Market (DOM)",
    definition:
      "Days on Market is how long a listing has been advertised — a high DOM hints at overpricing or weak demand.",
    howCalculated:
      "Measured from a listing's first-seen date in our portal sweeps to today. We surface median and max DOM per building on the condo report.",
    related: ["bubble-index"],
  },
  {
    slug: "mrr",
    term: "MRR (Minimum Retail Rate)",
    definition:
      "MRR is a benchmark lending rate published by Thai banks; it sets the baseline for most Thai mortgage pricing.",
    howCalculated:
      "We track the Bank of Thailand MRR series (macro_indicators, series FM_RT_001_S2) and use it as the financing-cost reference in yield and affordability context.",
    related: ["gross-yield"],
  },
  {
    slug: "completion-year",
    term: "Completion Year",
    definition:
      "Completion Year is the year a condominium was finished and handed over — a proxy for building age, condition, and depreciation.",
    howCalculated:
      "Sourced per building (condos.completion_year). Newer completions command price premiums; older buildings often show higher gross yields.",
    related: ["gross-yield", "price-per-sqm"],
  },
];


/** Korean and Thai prose, keyed by slug. A term missing from this map
 *  renders its English copy rather than an empty page. */
const GLOSSARY_I18N: Record<string, Partial<Record<"ko" | "th", GlossaryCopy>>> = {
  "bubble-index": {
    ko: {
      term: "버블 지수",
      definition:
        "RealData의 버블 지수는 콘도의 호가를 해당 구의 ㎡당 중위 가격과 비교해 점수화합니다. 100이면 평균 수준, 100 초과는 고평가, 100 미만은 저평가입니다.",
      howCalculated:
        "건물의 현재 매물에서 ㎡당 중위 매매가를 구해 구 중위값으로 나눈 뒤 100 기준으로 지수화합니다. 115면 구 평균보다 약 15% 비싸다는 뜻이고, 85면 약 15% 싸다는 뜻입니다. value_scores.bubble_index에 저장됩니다.",
    },
    th: {
      term: "ดัชนีฟองสบู่",
      definition:
        "ดัชนีฟองสบู่ของ RealData ให้คะแนนราคาเสนอขายของคอนโดเทียบกับราคามัธยฐานต่อตารางเมตรของเขตนั้น 100 คือเท่ากับค่ากลาง สูงกว่า 100 คือแพงเกิน ต่ำกว่า 100 คือถูกกว่าตลาด",
      howCalculated:
        "เรานำราคาขายมัธยฐานต่อตารางเมตรของอาคารจากประกาศที่ยังเปิดอยู่ หารด้วยค่ามัธยฐานของเขต แล้วทำดัชนีที่ฐาน 100 ค่า 115 หมายถึงอาคารนี้ตั้งราคาสูงกว่าเขตราว 15% ส่วน 85 คือต่ำกว่าราว 15% เก็บไว้ที่ value_scores.bubble_index",
    },
  },
  "resale-liquidity": {
    ko: {
      term: "재매각 유동성 점수",
      definition:
        "RealData의 재매각 유동성 점수(0~100)는 해당 건물의 매물이 얼마나 쉽게 되팔리는지를 추정합니다. 높을수록 매수자를 빨리 찾고 공급이 더 많이 소화됩니다.",
      howCalculated:
        "건물의 모든 매도 매물을 등장한 날부터 시장에서 사라진 날까지 추적합니다. 최근 공급 중 실제로 소화된 비율(흡수율), 소화 속도, 현재 미판매 재고가 얼마나 오래 남아 있는지를 결합합니다. 추적 표본이 부족한 건물은 오해를 부르는 점수를 내는 대신 점수를 표시하지 않습니다. value_scores.liquidity_score에 저장됩니다. 매도 가능성 신호이지 매도 가격을 보장하지 않습니다.",
    },
    th: {
      term: "คะแนนสภาพคล่องการขายต่อ",
      definition:
        "คะแนนสภาพคล่องการขายต่อของ RealData (0-100) ประเมินว่าห้องในอาคารนั้นขายต่อได้ง่ายแค่ไหน ยิ่งสูงยิ่งหาผู้ซื้อได้เร็วและอุปทานถูกดูดซับมากขึ้น",
      howCalculated:
        "เราติดตามประกาศขายทุกรายการในอาคารตั้งแต่วันที่ปรากฏจนถึงวันที่หายไปจากตลาด คะแนนผสมระหว่างสัดส่วนอุปทานที่ถูกดูดซับจริง ความเร็วในการดูดซับ และระยะเวลาที่สินค้าคงเหลือปัจจุบันค้างอยู่ อาคารที่มีตัวอย่างน้อยเกินไปจะไม่แสดงคะแนนแทนที่จะแสดงตัวเลขที่ทำให้เข้าใจผิด เก็บที่ value_scores.liquidity_score เป็นสัญญาณสภาพคล่อง ไม่ใช่การรับประกันราคาขาย",
    },
  },
  "retiree-suitability": {
    ko: {
      term: "은퇴 적합도 점수",
      definition:
        "RealData의 은퇴 적합도 점수(0~100)는 건물의 입지가 은퇴자에게 얼마나 맞는지를 평가하며, 의료 접근성과 대기질에 교통·생활 편의보다 큰 가중치를 둡니다.",
      howCalculated:
        "1km 내 병원·클리닉 수, 대기질(WAQI AQI), 가장 가까운 BTS/MRT까지의 거리, 1km 내 슈퍼마켓을 결합합니다. 젊은 투자자가 아니라 태국 은퇴 비자(O-A/O-X) 매수자에게 중요한 요소에 가중치를 둡니다. 위치 데이터가 없는 건물은 점수를 표시하지 않습니다.",
    },
    th: {
      term: "คะแนนความเหมาะกับผู้เกษียณ",
      definition:
        "คะแนนความเหมาะกับผู้เกษียณของ RealData (0-100) ประเมินว่าทำเลของอาคารเหมาะกับผู้เกษียณเพียงใด โดยให้น้ำหนักการเข้าถึงการรักษาพยาบาลและคุณภาพอากาศมากกว่าระบบขนส่งและความสะดวกประจำวัน",
      howCalculated:
        "เราผสมความใกล้สถานพยาบาล (โรงพยาบาล/คลินิกในรัศมี 1 กม.) คุณภาพอากาศ (WAQI AQI) ระยะถึงสถานี BTS/MRT ที่ใกล้ที่สุด และซูเปอร์มาร์เก็ตในรัศมี 1 กม. โดยถ่วงน้ำหนักไปที่ปัจจัยที่สำคัญต่อผู้ซื้อที่ถือวีซ่าเกษียณ (O-A/O-X) มากกว่านักลงทุนวัยหนุ่มสาว อาคารที่ไม่มีข้อมูลทำเลจะไม่แสดงคะแนน",
    },
  },
  "gross-yield": {
    ko: {
      term: "총 임대수익률",
      definition:
        "총 임대수익률은 비용을 빼기 전 연간 임대 수입을 매입가로 나눈 비율로, 방콕 콘도의 수익성을 빠르게 가늠하는 지표입니다.",
      howCalculated:
        "건물의 현재 매도·임대 매물에서 (중위 월세 x 12) / 중위 매매가를 계산해 백분율로 표시합니다(condos.gross_yield_pct). 방콕 콘도는 보통 총 4~7% 구간입니다.",
    },
    th: {
      term: "ผลตอบแทนค่าเช่าขั้นต้น",
      definition:
        "ผลตอบแทนค่าเช่าขั้นต้นคือรายได้ค่าเช่าต่อปีคิดเป็นเปอร์เซ็นต์ของราคาซื้อ ก่อนหักค่าใช้จ่าย ใช้ประเมินผลตอบแทนของคอนโดกรุงเทพฯ อย่างรวดเร็ว",
      howCalculated:
        "เราคำนวณ (ค่าเช่ามัธยฐานต่อเดือน x 12) หารด้วยราคาขายมัธยฐานของอาคาร จากประกาศขายและเช่าที่ยังเปิดอยู่ แสดงเป็นเปอร์เซ็นต์ (condos.gross_yield_pct) คอนโดกรุงเทพฯ มักอยู่ที่ 4-7% ขั้นต้น",
    },
  },
  "price-per-sqm": {
    ko: {
      term: "㎡당 가격",
      definition:
        "㎡당 가격은 콘도 가격을 면적으로 정규화해, 평형 구성이 다른 건물끼리도 같은 기준으로 비교할 수 있게 합니다.",
      howCalculated:
        "건물의 현재 매물 기준 중위 호가를 전용 면적으로 나눈 THB/㎡ 값입니다. 버블 지수의 기초 입력값입니다.",
    },
    th: {
      term: "ราคาต่อตารางเมตร",
      definition:
        "ราคาต่อตารางเมตรปรับราคาคอนโดให้เป็นมาตรฐานตามขนาดห้อง จึงเทียบอาคารที่มีสัดส่วนห้องต่างกันได้อย่างเป็นธรรม",
      howCalculated:
        "ราคาเสนอขายมัธยฐานหารด้วยพื้นที่ใช้สอยจากประกาศที่ยังเปิดอยู่ของอาคาร หน่วยเป็นบาทต่อตารางเมตร เป็นข้อมูลตั้งต้นของดัชนีฟองสบู่",
    },
  },
  "flood-risk-level": {
    ko: {
      term: "침수 위험 등급 (L1~L5)",
      definition:
        "침수 위험 등급은 해당 위치의 침수 노출도를 방콕 구 단위 침수 모델에 근거해 L1(가장 낮음)부터 L5(가장 높음)까지 5단계로 평가합니다.",
      howCalculated:
        "각 건물은 방콕 침수 레이어에서 자기 구 폴리곤의 등급을 그대로 받습니다(risk_factors.flood_risk_level). 건물별 점수가 따로 있으면 구 값을 덮어씁니다. 침수 페이지의 실시간 지도를 참고하세요.",
    },
    th: {
      term: "ระดับความเสี่ยงน้ำท่วม (L1-L5)",
      definition:
        "ระดับความเสี่ยงน้ำท่วมประเมินการเผชิญน้ำท่วมของทำเลด้วยมาตรวัด 5 ขั้น ตั้งแต่ L1 (ต่ำสุด) ถึง L5 (สูงสุด) อ้างอิงแบบจำลองน้ำท่วมระดับเขตของกรุงเทพฯ",
      howCalculated:
        "อาคารแต่ละแห่งรับระดับน้ำท่วมของโพลิกอนเขตตนเองจากชั้นข้อมูลน้ำท่วมกรุงเทพฯ ของเรา (risk_factors.flood_risk_level) หากมีคะแนนรายอาคารจะใช้แทนค่าระดับเขต ดูแผนที่สดได้ที่หน้าน้ำท่วม",
    },
  },
  "developer-track-record": {
    ko: {
      term: "시행사 실적",
      definition:
        "시행사 실적은 그 시행사가 지어온 프로젝트의 규모와 이력으로, 특히 선분양 콘도에서 준공 경험과 미완공 위험을 가늠하는 대리 지표입니다.",
      howCalculated:
        "각 건물의 FazWaz 프로젝트 페이지에서 시행사를 읽어 포트폴리오 규모(프로젝트 수와 총 세대 수)를 표시합니다. 포트폴리오가 클수록 대개 준공 이력이 길고 미완공 위험이 낮지만, 개별 프로젝트의 시공 품질을 보장하지는 않습니다. condos.developer / developer_project_count / developer_unit_count에 저장됩니다.",
    },
    th: {
      term: "ผลงานที่ผ่านมาของผู้พัฒนา",
      definition:
        "ผลงานที่ผ่านมาของผู้พัฒนาคือขนาดและประวัติของโครงการที่เคยสร้าง เป็นตัวแทนบอกประสบการณ์การส่งมอบและความเสี่ยงที่โครงการจะไม่เสร็จ โดยเฉพาะคอนโดขายก่อนสร้าง",
      howCalculated:
        "เราอ่านชื่อผู้พัฒนาจากหน้าโครงการบน FazWaz ของแต่ละอาคาร แล้วแสดงขนาดพอร์ต (จำนวนโครงการและจำนวนยูนิตรวม) พอร์ตที่ใหญ่กว่ามักหมายถึงประวัติการส่งมอบที่ยาวกว่าและความเสี่ยงต่ำกว่า แต่ไม่รับประกันคุณภาพงานก่อสร้างของโครงการใดโครงการหนึ่ง เก็บที่ condos.developer / developer_project_count / developer_unit_count",
    },
  },
  "ground-stability": {
    ko: {
      term: "지반 안정성 (지반 침하, L1~L5)",
      definition:
        "지반 안정성은 방콕이 연약한 해성 점토 위에 있다는 점을 반영해, 지반 침하로 땅이 얼마나 가라앉고 있는지를 L1(매우 낮음)부터 L5(심각)까지 5단계로 평가합니다.",
      howCalculated:
        "공개된 InSAR 및 지하수 관측 연구를 바탕으로 각 건물에 해당 구의 침하 등급을 부여합니다(risk_factors.subsidence_level). 방콕은 1980년대에 연 120mm까지 가라앉았고, 지하수 규제로 도심 속도는 거의 0에 가까워졌지만 동부 연약 점토대와 남부 해안은 계속 침하 중이며 이는 10~20년 시계에서 우기 침수 위험을 가중시킵니다. 건물별 측량이 아니라 구 단위 추정치입니다.",
    },
    th: {
      term: "เสถียรภาพของดิน (แผ่นดินทรุด L1-L5)",
      definition:
        "เสถียรภาพของดินประเมินว่าทำเลนั้นทรุดตัวมากแค่ไหนจากการทรุดของแผ่นดิน ด้วยมาตรวัด 5 ขั้นตั้งแต่ L1 (ต่ำมาก) ถึง L5 (รุนแรง) เพราะกรุงเทพฯ ตั้งอยู่บนดินเหนียวทะเลอ่อน",
      howCalculated:
        "เรากำหนดระดับการทรุดตัวของเขตให้แต่ละอาคาร (risk_factors.subsidence_level) จากงานศึกษา InSAR และการตรวจวัดน้ำบาดาลที่เผยแพร่แล้ว กรุงเทพฯ เคยทรุดเร็วถึงราว 120 มม./ปี ในทศวรรษ 1980 การควบคุมน้ำบาดาลลดอัตราในเขตชั้นในลงเกือบเป็นศูนย์ แต่แนวดินเหนียวอ่อนฝั่งตะวันออกและพื้นที่ชายฝั่งทางใต้ยังทรุดต่อเนื่อง ซึ่งซ้ำเติมความเสี่ยงน้ำท่วมในระยะ 10-20 ปี เป็นค่าประมาณระดับเขต ไม่ใช่การสำรวจรายอาคาร",
    },
  },
  "foreign-quota": {
    ko: {
      term: "외국인 소유 쿼터 (49%)",
      definition:
        "태국 법은 외국인이 한 콘도미니엄의 총 분양 면적 중 최대 49%까지 합산 보유하도록 허용하며, 나머지 51%는 태국인 소유여야 합니다.",
      howCalculated:
        "콘도미니엄법 B.E. 2522에 규정돼 있습니다. 건물의 잔여 외국인 쿼터가 외국인이 해당 세대를 자유 보유(freehold)로 살 수 있는지를 결정합니다. 외국인 소유 가이드를 참고하세요.",
    },
    th: {
      term: "โควตากรรมสิทธิ์ต่างชาติ (49%)",
      definition:
        "กฎหมายไทยให้ชาวต่างชาติถือกรรมสิทธิ์รวมกันได้ไม่เกิน 49% ของพื้นที่ขายทั้งหมดในอาคารชุดแต่ละแห่ง ส่วนอีก 51% ต้องเป็นของคนไทย",
      howCalculated:
        "กำหนดโดยพระราชบัญญัติอาคารชุด พ.ศ. 2522 โควตาต่างชาติที่เหลือของอาคารเป็นตัวกำหนดว่าชาวต่างชาติจะซื้อห้องนั้นแบบ freehold ได้หรือไม่ ดูคู่มือกรรมสิทธิ์ต่างชาติของเรา",
    },
  },
  "freehold": {
    ko: {
      term: "자유 보유 (Freehold)",
      definition:
        "자유 보유는 콘도 세대를 본인 명의로 기한 없이 완전히 소유하는 것으로, 토지국에 등기됩니다.",
      howCalculated:
        "외국인은 건물의 49% 외국인 쿼터 범위 안에서만 자유 보유가 가능하며, 매입 자금을 외화로 해외에서 송금해야 합니다(FET 서류).",
    },
    th: {
      term: "กรรมสิทธิ์สมบูรณ์ (Freehold)",
      definition:
        "Freehold คือการถือกรรมสิทธิ์ห้องชุดอย่างสมบูรณ์และไม่มีกำหนดเวลาในชื่อของตนเอง จดทะเบียนที่กรมที่ดิน",
      howCalculated:
        "ชาวต่างชาติถือ freehold ได้เฉพาะภายในโควตาต่างชาติ 49% ของอาคาร และต้องโอนเงินค่าซื้อจากต่างประเทศเป็นเงินตราต่างประเทศ (แบบ FET)",
    },
  },
  "leasehold": {
    ko: {
      term: "임차 보유 (Leasehold)",
      definition:
        "임차 보유는 등기된 장기 임차권으로, 1회 최장 30년이며 자유 보유가 불가능할 때나 토지·빌라에 주로 사용됩니다.",
      howCalculated:
        "임차권은 토지국에 최장 30년으로 등기됩니다. 갱신 조항은 계약상 약정일 뿐 자동으로 강제되지 않습니다. 건물의 외국인 쿼터가 소진됐을 때 흔히 사용됩니다.",
    },
    th: {
      term: "สิทธิการเช่าระยะยาว (Leasehold)",
      definition:
        "Leasehold คือการเช่าทรัพย์สินระยะยาวที่จดทะเบียน สูงสุด 30 ปีต่อหนึ่งสัญญา ใช้เมื่อชาวต่างชาติถือ freehold ไม่ได้ หรือใช้กับที่ดินและบ้านเดี่ยว",
      howCalculated:
        "สัญญาเช่าจดทะเบียนที่กรมที่ดินได้สูงสุด 30 ปี ข้อตกลงต่ออายุเป็นเพียงข้อสัญญา ไม่ได้บังคับได้โดยอัตโนมัติ พบบ่อยเมื่อโควตาต่างชาติของอาคารเต็มแล้ว",
    },
  },
  "livability-score": {
    ko: {
      term: "생활 편의 점수",
      definition:
        "생활 편의 점수는 건물 입지의 편리함을 요약합니다 — 철도 교통 접근성과 인근 병원·학교·슈퍼마켓을 함께 봅니다.",
      howCalculated:
        "livability_metrics에서 산출합니다: 가장 가까운 BTS/MRT역까지의 거리, 그리고 1km 내 병원·학교·슈퍼마켓 수. 역이 가깝고 편의시설이 밀집할수록 점수가 올라갑니다.",
    },
    th: {
      term: "คะแนนคุณภาพการอยู่อาศัย",
      definition:
        "คะแนนคุณภาพการอยู่อาศัยสรุปว่าทำเลของอาคารสะดวกเพียงใด ทั้งความใกล้รถไฟฟ้าและโรงพยาบาล โรงเรียน ซูเปอร์มาร์เก็ตโดยรอบ",
      howCalculated:
        "คำนวณจาก livability_metrics: ระยะถึงสถานี BTS/MRT ที่ใกล้ที่สุด และจำนวนโรงพยาบาล โรงเรียน และซูเปอร์มาร์เก็ตในรัศมี 1 กม. ยิ่งใกล้รถไฟฟ้าและมีสิ่งอำนวยความสะดวกหนาแน่น คะแนนยิ่งสูง",
    },
  },
  "super-value": {
    ko: {
      term: "슈퍼 밸류",
      definition:
        "슈퍼 밸류 배지는 같은 구의 비교 가능한 건물 대비 우리 모델이 뚜렷하게 저평가로 판단한 콘도에 붙습니다.",
      howCalculated:
        "건물의 버블 지수가 구 중위값보다 충분히 낮고, 신뢰할 만한 매물 표본이 확보됐을 때 부여됩니다(value_scores.is_super_value).",
    },
    th: {
      term: "คุ้มค่าเป็นพิเศษ",
      definition:
        "ป้ายคุ้มค่าเป็นพิเศษติดให้คอนโดที่แบบจำลองของเราเห็นว่าราคาต่ำกว่าที่ควรอย่างมีนัยสำคัญ เมื่อเทียบกับอาคารใกล้เคียงในเขตเดียวกัน",
      howCalculated:
        "กำหนดเมื่อดัชนีฟองสบู่ของอาคารอยู่ต่ำกว่าค่ามัธยฐานของเขตพอสมควร และมีจำนวนประกาศมากพอที่จะเชื่อถือได้ (value_scores.is_super_value)",
    },
  },
  "days-on-market": {
    ko: {
      term: "시장 체류 일수 (DOM)",
      definition:
        "시장 체류 일수는 매물이 광고된 기간으로, DOM이 길면 고평가이거나 수요가 약하다는 신호입니다.",
      howCalculated:
        "포털 수집에서 매물이 처음 관측된 날부터 오늘까지로 측정합니다. 콘도 리포트에 건물별 중위 DOM과 최대 DOM을 표시합니다.",
    },
    th: {
      term: "จำนวนวันบนตลาด (DOM)",
      definition:
        "จำนวนวันบนตลาดคือระยะเวลาที่ประกาศถูกลงขาย ค่า DOM สูงบ่งชี้ว่าตั้งราคาสูงเกินหรือดีมานด์อ่อน",
      howCalculated:
        "วัดจากวันที่เราพบประกาศครั้งแรกในการเก็บข้อมูลพอร์ทัลจนถึงวันนี้ เราแสดงค่ามัธยฐานและค่าสูงสุดของ DOM รายอาคารในรายงานคอนโด",
    },
  },
  "mrr": {
    ko: {
      term: "MRR (최저 소매 금리)",
      definition:
        "MRR은 태국 은행들이 고시하는 기준 대출 금리로, 태국 주택담보대출 가격 결정의 기준선이 됩니다.",
      howCalculated:
        "태국 중앙은행 MRR 시계열(macro_indicators, 시리즈 FM_RT_001_S2)을 추적해, 수익률과 부담 가능성을 따질 때 금융 비용 기준으로 사용합니다.",
    },
    th: {
      term: "MRR (อัตราดอกเบี้ยลูกค้ารายย่อยชั้นดี)",
      definition:
        "MRR คืออัตราดอกเบี้ยอ้างอิงที่ธนาคารไทยประกาศ ใช้เป็นฐานในการกำหนดดอกเบี้ยสินเชื่อบ้านส่วนใหญ่ในไทย",
      howCalculated:
        "เราติดตามชุดข้อมูล MRR ของธนาคารแห่งประเทศไทย (macro_indicators ชุด FM_RT_001_S2) และใช้เป็นตัวอ้างอิงต้นทุนทางการเงินในบริบทของผลตอบแทนและความสามารถในการซื้อ",
    },
  },
  "completion-year": {
    ko: {
      term: "준공 연도",
      definition:
        "준공 연도는 콘도미니엄이 완공되어 인도된 해로, 건물 연식과 상태, 감가를 가늠하는 대리 지표입니다.",
      howCalculated:
        "건물별로 수집합니다(condos.completion_year). 신축일수록 가격 프리미엄이 붙고, 오래된 건물일수록 총 임대수익률이 높게 나오는 경우가 많습니다.",
    },
    th: {
      term: "ปีที่สร้างเสร็จ",
      definition:
        "ปีที่สร้างเสร็จคือปีที่อาคารชุดก่อสร้างเสร็จและส่งมอบ ใช้เป็นตัวแทนบอกอายุอาคาร สภาพ และการเสื่อมราคา",
      howCalculated:
        "เก็บข้อมูลรายอาคาร (condos.completion_year) อาคารใหม่มักได้ราคาพรีเมียม ส่วนอาคารเก่ามักให้ผลตอบแทนค่าเช่าขั้นต้นสูงกว่า",
    },
  },
};

const BY_SLUG = new Map(GLOSSARY.map((t) => [t.slug, t]));

/** The term as it should read in `lang`. Falls back to English per-term,
 *  so adding a term without a translation degrades to English instead of
 *  breaking the page. */
export function localizeTerm(t: GlossaryTerm, lang: string): GlossaryTerm {
  const loc = lang === "ko" || lang === "th" ? GLOSSARY_I18N[t.slug]?.[lang] : undefined;
  return loc ? { ...t, ...loc } : t;
}

export function getTerm(slug: string): GlossaryTerm | null {
  return BY_SLUG.get(slug) ?? null;
}

export function allTermSlugs(): string[] {
  return GLOSSARY.map((t) => t.slug);
}
