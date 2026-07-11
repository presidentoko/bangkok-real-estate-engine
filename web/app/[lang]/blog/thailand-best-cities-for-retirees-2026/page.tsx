import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkShareButtons } from "@/components/LinkShareButtons";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL = SEO_SITE_URL;
const SLUG = "thailand-best-cities-for-retirees-2026";
const PUBLISHED = "2026-06-17";

export const revalidate = 86400;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Best Cities to Retire in Thailand 2026 — Ranked by Healthcare, Air & Walkability | RealData",
    desc: "Data-driven ranking of Phuket, Pattaya, Chiang Mai, Hua Hin, and Bangkok for retirees. Scored on hospitals within 1km, annual PM2.5, transit access, and daily errands. No broker placement.",
    ogTitle: "Best Cities to Retire in Thailand 2026 — Data Ranked",
    ogDesc: "We scored 5 Thai cities across healthcare, air quality, transit, and walkability. Here's what the numbers actually say.",
  },
  ko: {
    title: "2026 태국 은퇴지 최고 도시 — 의료·공기질·교통 데이터 랭킹 | RealData",
    desc: "푸켓, 파타야, 치앙마이, 후아힌, 방콕을 은퇴자 관점에서 데이터로 비교. 1km 내 병원 수, 연평균 PM2.5, 대중교통, 생활 편의시설 4가지 기준.",
    ogTitle: "2026 태국 은퇴지 TOP 5 도시 — 데이터로 비교",
    ogDesc: "의료·공기·교통·편의 4가지로 직접 점수 낸 태국 5개 도시 비교.",
  },
  th: {
    title: "เมืองที่ดีที่สุดสำหรับเกษียณในไทย 2026 — จัดอันดับด้วยข้อมูลด้านสุขภาพ อากาศ และความสะดวก | RealData",
    desc: "จัดอันดับภูเก็ต พัทยา เชียงใหม่ หัวหิน กรุงเทพ ด้วยข้อมูล: โรงพยาบาลในรัศมี 1 กม. PM2.5 รายปี ระบบขนส่ง และร้านค้าใกล้บ้าน",
    ogTitle: "เมืองเกษียณที่ดีที่สุดในไทย 2026 — วัดด้วยข้อมูล",
    ogDesc: "เปรียบเทียบ 5 เมืองไทยด้วยคะแนน 4 ด้านสำหรับผู้เกษียณ",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const useLang: Lang = isLang(lang) ? lang : "en";
  const m = META[useLang];
  return {
    title: m.title,
    description: m.desc,
    keywords: [
      "retire in Thailand", "best city to retire Thailand", "Thailand retirement 2026",
      "Phuket retirement", "Pattaya retirement", "Chiang Mai retirement", "Hua Hin retirement",
      "Thailand LTR visa", "retire Thailand healthcare", "Thailand expat retirement",
      "태국 은퇴 도시", "태국 은퇴 비자", "태국 노후", "푸켓 은퇴", "파타야 은퇴",
      "เกษียณที่ไทย", "วีซ่าเกษียณไทย", "เกษียณภูเก็ต",
    ],
    alternates: {
      canonical: `${SITE_URL}/${useLang}/blog/${SLUG}`,
      languages: langAlternates(`/blog/${SLUG}`),
    },
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
      url: `${SITE_URL}/${useLang}/blog/${SLUG}`,
      type: "article",
      publishedTime: PUBLISHED,
      locale: useLang,
    },
  };
}

type CityScore = {
  slug: string;
  count: number;
  avgScore: number;
  topScore: number;
};

const CITIES_DATA = [
  {
    slug: "phuket",
    dbSlugs: ["phuket"],
    en: "Phuket",
    ko: "푸켓",
    th: "ภูเก็ต",
    retireeLink: "/retiree/phuket",
    hospitals: "Bangkok Hospital Phuket, Phuket International Hospital",
    hospitalsTh: "Bangkok Hospital Phuket, Phuket International Hospital",
    pros: {
      en: ["Internationally accredited hospitals", "Clean sea air — avg AQI 35–45", "Strong expat + Russian community", "Foreign freehold condo market"],
      ko: ["국제 인증 병원", "맑은 해양 공기 — 평균 AQI 35~45", "외국인·러시아 커뮤니티", "외국인 분양 콘도 시장"],
      th: ["โรงพยาบาลมาตรฐานสากล", "อากาศทะเลสะอาด AQI 35–45", "ชุมชนต่างชาติและรัสเซียแข็งแกร่ง", "คอนโดฟรีโฮลด์ต่างชาติ"],
    },
    cons: {
      en: ["Car-dependent — poor walkability outside Patong", "Higher condo prices (beach premium)", "Hot and humid year-round"],
      ko: ["차 없이 불편 — 빠통 외 도보 생활 어려움", "콘도 가격 높음 (해변 프리미엄)", "연중 덥고 습함"],
      th: ["ต้องพึ่งรถยนต์นอกป่าตอง", "ราคาคอนโดสูง (พรีเมียมหน้าหาด)", "ร้อนชื้นตลอดปี"],
    },
    bestFor: {
      en: "Beach lifestyle retirees, holiday-rental investors who live on-site",
      ko: "해변 라이프스타일 은퇴자, 현장 거주 임대 투자자",
      th: "ผู้เกษียณชีวิตชายหาด นักลงทุนเช่ารายวันที่อยู่อาศัยเอง",
    },
  },
  {
    slug: "pattaya",
    dbSlugs: ["pattaya"],
    en: "Pattaya",
    ko: "파타야",
    th: "พัทยา",
    retireeLink: "/retiree/pattaya",
    hospitals: "Bangkok Hospital Pattaya, Pattaya International Hospital",
    hospitalsTh: "Bangkok Hospital Pattaya, Pattaya International Hospital",
    pros: {
      en: ["Two major private hospitals", "Largest foreign-resident expat community outside Bangkok", "Lower prices than Phuket", "2 hrs from Bangkok by bus"],
      ko: ["대형 사립병원 2개", "방콕 외 최대 외국인 거주 커뮤니티", "푸켓보다 저렴한 가격", "버스로 방콕 2시간"],
      th: ["โรงพยาบาลเอกชนขนาดใหญ่ 2 แห่ง", "ชุมชนต่างชาติใหญ่สุดนอกกรุงเทพ", "ราคาถูกกว่าภูเก็ต", "รถบัสไปกรุงเทพ 2 ชม."],
    },
    cons: {
      en: ["Beach quality lower than Phuket", "Car-dependent city layout", "Noisy entertainment zones in central Pattaya"],
      ko: ["해변 품질 푸켓 대비 낮음", "자가용 의존 도시 구조", "파타야 중심부 유흥가 소음"],
      th: ["คุณภาพหาดต่ำกว่าภูเก็ต", "เมืองต้องพึ่งรถยนต์", "โซนบันเทิงเสียงดังในพัทยากลาง"],
    },
    bestFor: {
      en: "Budget-conscious retirees who want a large expat network and city convenience",
      ko: "대규모 외국인 네트워크와 도시 편의를 원하는 알뜰 은퇴자",
      th: "ผู้เกษียณงบประมาณจำกัดที่ต้องการเครือข่ายต่างชาติและความสะดวกเมือง",
    },
  },
  {
    slug: "chiangmai",
    dbSlugs: ["chiangmai", "chiang-mai"],
    en: "Chiang Mai",
    ko: "치앙마이",
    th: "เชียงใหม่",
    retireeLink: "/retiree/chiangmai",
    hospitals: "Chiang Mai Ram Hospital, Bangkok Hospital Chiang Mai, McCormick Hospital",
    hospitalsTh: "โรงพยาบาลเชียงใหม่ราม, โรงพยาบาล Bangkok Hospital เชียงใหม่, โรงพยาบาล McCormick",
    pros: {
      en: ["Highest hospital density of any Thai city outside Bangkok", "Lowest cost of living", "Strong digital nomad + retiree community", "Excellent Thai food + culture scene"],
      ko: ["방콕 외 태국 최고 병원 밀도", "가장 낮은 생활비", "강한 디지털 노마드·은퇴자 커뮤니티", "훌륭한 태국 음식·문화"],
      th: ["ความหนาแน่นโรงพยาบาลสูงสุดนอกกรุงเทพ", "ค่าครองชีพถูกสุด", "ชุมชนดิจิทัลโนแมดและผู้เกษียณแข็งแกร่ง", "อาหารและวัฒนธรรมไทยเยี่ยม"],
    },
    cons: {
      en: ["Severe smoke season Jan–Apr (AQI 150–300+)", "No direct sea access", "Condo supply limited vs Bangkok"],
      ko: ["1~4월 극심한 연무 시즌 (AQI 150~300+)", "바다 없음", "방콕 대비 콘도 공급 제한적"],
      th: ["ฤดูหมอกควันรุนแรง ม.ค.–เม.ย. (AQI 150–300+)", "ไม่มีทะเล", "อุปทานคอนโดน้อยกว่ากรุงเทพ"],
    },
    bestFor: {
      en: "Budget-first retirees who can leave during smoke season (Jan–Apr)",
      ko: "연무 시즌(1~4월)에 피할 수 있는 알뜰 은퇴자",
      th: "ผู้เกษียณที่เน้นประหยัดและสามารถออกนอกพื้นที่ช่วงหมอกควัน (ม.ค.–เม.ย.)",
    },
  },
  {
    slug: "huahin",
    dbSlugs: ["huahin", "hua-hin"],
    en: "Hua Hin",
    ko: "후아힌",
    th: "หัวหิน",
    retireeLink: "/retiree/huahin",
    hospitals: "Hua Hin Hospital, Bangkok Hospital Hua Hin",
    hospitalsTh: "โรงพยาบาลหัวหิน, Bangkok Hospital หัวหิน",
    pros: {
      en: ["Cleanest air of the big 5 — Gulf breeze keeps AQI low", "Quietest, most relaxed pace", "Bangkok Hospital branch on-site", "Strong Scandinavian + European retiree community"],
      ko: ["5대 도시 중 공기 최고 — 걸프 바람으로 AQI 낮음", "가장 조용하고 여유로운 생활", "방콕 병원 분원 상주", "강한 스칸디나비아·유럽 은퇴자 커뮤니티"],
      th: ["อากาศสะอาดสุดในบิ๊ก 5 — ลมอ่าวไทยทำ AQI ต่ำ", "เงียบและผ่อนคลายสุด", "สาขา Bangkok Hospital ในพื้นที่", "ชุมชนผู้เกษียณสแกนดิเนเวีย/ยุโรปแข็งแกร่ง"],
    },
    cons: {
      en: ["Only one major hospital (Bangkok Hospital Hua Hin)", "No BTS/MRT — fully car-dependent", "Smaller social scene than Pattaya or Bangkok"],
      ko: ["대형 병원 1개뿐", "BTS/MRT 없음 — 완전 자가용 의존", "파타야·방콕 대비 사교 활동 제한적"],
      th: ["โรงพยาบาลใหญ่แห่งเดียว", "ไม่มี BTS/MRT ต้องพึ่งรถยนต์", "กิจกรรมสังคมน้อยกว่าพัทยาและกรุงเทพ"],
    },
    bestFor: {
      en: "Quiet-life seekers, Northern European retirees, couples who own a car",
      ko: "조용한 생활 추구자, 북유럽 은퇴자, 차를 소유한 커플",
      th: "ผู้ที่ต้องการชีวิตเงียบสงบ ผู้เกษียณยุโรปเหนือ คู่รักที่มีรถยนต์",
    },
  },
];

const CONTENT: Record<Lang, {
  backlink: string;
  h1: string;
  byline: string;
  intro: string[];
  scoreSectionTitle: string;
  scoreSectionLead: string;
  scoreLabel: string;
  condosLabel: string;
  topScoreLabel: string;
  dataLinkLabel: string;
  citySectionTitle: string;
  prosLabel: string;
  consLabel: string;
  bestForLabel: string;
  hospitalLabel: string;
  verdictTitle: string;
  verdictRows: { city: string; verdict: string }[];
  methodTitle: string;
  methodItems: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaLink: string;
}> = {
  en: {
    backlink: "← Blog",
    h1: "Best Cities to Retire in Thailand 2026 — Data Ranked",
    byline: "RealData analysis · Jun 2026",
    intro: [
      "Retire in Thailand is one of the top Google searches among expats considering a move to Southeast Asia. The answers you'll find are mostly listicles funded by agencies selling condos in the places they're recommending.",
      "We scored every city differently: hospitals within 1km (40%), annual average AQI (25%), distance to the nearest transit station (20%), and supermarkets within 1km (15%). These are the four factors that matter most when you're 65+, not when you're 35 trying to sound interesting at parties.",
      "Below is what the data says about the five most popular retirement destinations in Thailand. Scores are calculated from every condo in our database with GPS coordinates — not from marketing sheets.",
    ],
    scoreSectionTitle: "Retiree Score by City",
    scoreSectionLead: "Average score across condos rated ≥ 55 (Good or better). Data updates nightly.",
    scoreLabel: "Avg Score",
    condosLabel: "condos rated ≥55",
    topScoreLabel: "Top",
    dataLinkLabel: "See all ranked condos →",
    citySectionTitle: "City Breakdown",
    prosLabel: "Pros",
    consLabel: "Cons",
    bestForLabel: "Best for",
    hospitalLabel: "Major hospitals",
    verdictTitle: "Quick Reference: Who Should Live Where",
    verdictRows: [
      { city: "Phuket", verdict: "Beach lifestyle + internationally accredited hospitals. Pay a premium for both." },
      { city: "Pattaya", verdict: "Biggest expat community, lower prices, 2 hrs from Bangkok specialist hospitals." },
      { city: "Chiang Mai", verdict: "Cheapest + best hospital density, but evacuate Jan–Apr when AQI hits 200+." },
      { city: "Hua Hin", verdict: "Quietest, cleanest air, Scandinavian crowd. One hospital — plan medical trips to Bangkok." },
      { city: "Bangkok", verdict: "Best hospitals in Southeast Asia, worst air quality. For retirees who need regular specialist care." },
    ],
    methodTitle: "How the score works",
    methodItems: [
      "Healthcare (40%): hospitals within 1km via OpenStreetMap — 0 hospitals=10pts, 1=55pts, 2=75pts, 3=88pts, 4+=100pts",
      "Air quality (25%): annual average AQI from monitoring stations — ≤25=100pts, ≤50=85pts, ≤75=65pts, ≤100=45pts, ≤150=25pts",
      "Transit (20%): walking distance to nearest BTS/MRT/Songthaew hub — ≤300m=100pts, ≤500m=85pts, ≤800m=65pts, ≤1200m=40pts",
      "Daily errands (15%): supermarkets within 1km via OSM — 0=10pts, 1=50pts, 2=75pts, 3+=100pts",
      "Only condos scoring ≥55 shown as 'retirement suitable'",
    ],
    ctaTitle: "Need a shortlist for your city?",
    ctaBody: "We build personalised ranked shortlists for retirees based on your budget, healthcare priorities, and preferred city. No broker. No placement fees.",
    ctaLink: "Get a personalised shortlist →",
  },
  ko: {
    backlink: "← 블로그",
    h1: "2026 태국 은퇴지 최고 도시 — 데이터 랭킹",
    byline: "RealData 분석 · 2026년 6월",
    intro: [
      "'태국 은퇴'는 동남아 이주를 고민하는 외국인들의 가장 많이 검색되는 키워드 중 하나입니다. 검색 결과의 대부분은 추천 도시의 콘도를 파는 중개사들이 후원한 콘텐츠입니다.",
      "우리는 다른 기준으로 점수를 냈습니다: 1km 내 병원 수(40%), 연평균 PM2.5(25%), 가장 가까운 대중교통까지 거리(20%), 1km 내 슈퍼마켓 수(15%). 35살 파티에서 멋있어 보이려는 기준이 아니라, 65살 이후에 실제로 중요한 4가지 기준입니다.",
      "아래는 태국의 가장 인기 있는 은퇴지 5곳에 대해 데이터가 말하는 것입니다. 점수는 마케팅 자료가 아니라, GPS 좌표가 있는 우리 DB의 모든 콘도를 기반으로 계산합니다.",
    ],
    scoreSectionTitle: "도시별 은퇴자 점수",
    scoreSectionLead: "Good(≥55) 이상 등급 콘도의 평균 점수. 매일 밤 업데이트됩니다.",
    scoreLabel: "평균 점수",
    condosLabel: "개 콘도 (≥55점)",
    topScoreLabel: "최고",
    dataLinkLabel: "전체 랭킹 보기 →",
    citySectionTitle: "도시별 상세 분석",
    prosLabel: "장점",
    consLabel: "단점",
    bestForLabel: "추천 대상",
    hospitalLabel: "주요 병원",
    verdictTitle: "한눈에 보기: 어떤 사람이 어느 도시에?",
    verdictRows: [
      { city: "푸켓", verdict: "해변 라이프스타일 + 국제 인증 병원. 두 가지 모두 프리미엄을 지불해야 함." },
      { city: "파타야", verdict: "가장 큰 외국인 커뮤니티, 낮은 가격, 방콕 전문 병원까지 버스 2시간." },
      { city: "치앙마이", verdict: "가장 저렴 + 병원 밀도 최고. 단, AQI 200+ 되는 1~4월엔 탈출해야 함." },
      { city: "후아힌", verdict: "가장 조용하고 공기 깨끗, 북유럽 분위기. 병원 1개 — 큰 치료는 방콕행." },
      { city: "방콕", verdict: "동남아 최고 병원, 최악의 공기. 정기적 전문의 진료가 필요한 은퇴자에게." },
    ],
    methodTitle: "점수 계산 방식",
    methodItems: [
      "의료(40%): OpenStreetMap 기준 1km 내 병원 수 — 0개=10점, 1개=55점, 2개=75점, 3개=88점, 4개+=100점",
      "공기질(25%): 모니터링 스테이션 연평균 AQI — ≤25=100점, ≤50=85점, ≤75=65점, ≤100=45점, ≤150=25점",
      "대중교통(20%): 가장 가까운 BTS/MRT/송태우 허브까지 도보 거리 — ≤300m=100점, ≤500m=85점, ≤800m=65점, ≤1200m=40점",
      "생활 편의(15%): OSM 기준 1km 내 슈퍼마켓 수 — 0개=10점, 1개=50점, 2개=75점, 3개+=100점",
      "55점 이상 콘도만 '은퇴 적합'으로 표시",
    ],
    ctaTitle: "도시별 맞춤 추천이 필요하신가요?",
    ctaBody: "예산, 의료 우선순위, 선호 도시를 바탕으로 은퇴자 맞춤 랭킹 리스트를 만들어드립니다. 중개사 없음. 수수료 없음.",
    ctaLink: "맞춤 리스트 받기 →",
  },
  th: {
    backlink: "← บล็อก",
    h1: "เมืองที่ดีที่สุดสำหรับเกษียณในไทย 2026 — จัดอันดับด้วยข้อมูล",
    byline: "การวิเคราะห์ RealData · มิ.ย. 2026",
    intro: [
      "'เกษียณที่ไทย' เป็นหนึ่งในคำค้นหายอดนิยมของชาวต่างชาติที่กำลังคิดจะย้ายมาอยู่เอเชียตะวันออกเฉียงใต้ คำตอบส่วนใหญ่ที่พบในอินเทอร์เน็ตมาจากบทความที่ได้รับการสนับสนุนจากเอเจนต์ขายคอนโดในพื้นที่ที่แนะนำ",
      "เราให้คะแนนแต่ละเมืองต่างออกไป: โรงพยาบาลในรัศมี 1 กม. (40%) ค่าเฉลี่ย AQI รายปี (25%) ระยะเดินไปสถานีขนส่งที่ใกล้ที่สุด (20%) และซูเปอร์มาร์เก็ตในรัศมี 1 กม. (15%) ปัจจัยที่สำคัญเมื่ออายุ 65+ ไม่ใช่ตอนอายุ 35 ที่แค่อยากดูดี",
      "นี่คือสิ่งที่ข้อมูลบอกเกี่ยวกับ 5 เมืองยอดนิยมสำหรับผู้เกษียณในไทย คะแนนคำนวณจากคอนโดทุกหลังในฐานข้อมูลของเราที่มีพิกัด GPS ไม่ใช่จากเอกสารการตลาด",
    ],
    scoreSectionTitle: "คะแนนผู้เกษียณแยกตามเมือง",
    scoreSectionLead: "คะแนนเฉลี่ยของคอนโดที่ได้คะแนน ≥55 (ดีขึ้นไป) อัพเดทรายคืน",
    scoreLabel: "คะแนนเฉลี่ย",
    condosLabel: "คอนโดที่ได้ ≥55",
    topScoreLabel: "สูงสุด",
    dataLinkLabel: "ดูอันดับคอนโดทั้งหมด →",
    citySectionTitle: "รายละเอียดแต่ละเมือง",
    prosLabel: "ข้อดี",
    consLabel: "ข้อเสีย",
    bestForLabel: "เหมาะสำหรับ",
    hospitalLabel: "โรงพยาบาลหลัก",
    verdictTitle: "สรุปด่วน: ใครควรอยู่เมืองไหน",
    verdictRows: [
      { city: "ภูเก็ต", verdict: "ชีวิตชายหาด + โรงพยาบาลมาตรฐานสากล จ่ายพรีเมียมทั้งสองอย่าง" },
      { city: "พัทยา", verdict: "ชุมชนต่างชาติใหญ่สุด ราคาถูกกว่า รถบัสไปโรงพยาบาลเฉพาะทางกรุงเทพ 2 ชม." },
      { city: "เชียงใหม่", verdict: "ถูกสุด + ความหนาแน่นโรงพยาบาลดีสุด แต่ต้องหนีช่วง ม.ค.–เม.ย. AQI 200+" },
      { city: "หัวหิน", verdict: "เงียบสุด อากาศดีสุด บรรยากาศยุโรปเหนือ โรงพยาบาลแห่งเดียว — รักษาจริงจังต้องไปกรุงเทพ" },
      { city: "กรุงเทพ", verdict: "โรงพยาบาลดีที่สุดในเอเชียตะวันออกเฉียงใต้ อากาศแย่ที่สุด สำหรับผู้ต้องพบแพทย์เฉพาะทางสม่ำเสมอ" },
    ],
    methodTitle: "วิธีคำนวณคะแนน",
    methodItems: [
      "การแพทย์ (40%): จำนวนโรงพยาบาลในรัศมี 1 กม. จาก OpenStreetMap — 0=10คะแนน, 1=55, 2=75, 3=88, 4+=100",
      "คุณภาพอากาศ (25%): AQI เฉลี่ยรายปีจากสถานีตรวจวัด — ≤25=100, ≤50=85, ≤75=65, ≤100=45, ≤150=25",
      "ขนส่งสาธารณะ (20%): ระยะเดินไปสถานีที่ใกล้สุด — ≤300ม.=100, ≤500ม.=85, ≤800ม.=65, ≤1200ม.=40",
      "สิ่งอำนวยความสะดวก (15%): ซูเปอร์มาร์เก็ตในรัศมี 1 กม. — 0=10, 1=50, 2=75, 3+=100",
      "แสดงเฉพาะคอนโดที่ได้ ≥55 ว่า 'เหมาะสำหรับผู้เกษียณ'",
    ],
    ctaTitle: "ต้องการรายชื่อคอนโดที่เหมาะกับคุณ?",
    ctaBody: "เราสร้างรายชื่อคอนโดแบบเฉพาะบุคคลสำหรับผู้เกษียณ ตามงบประมาณ ความต้องการด้านการแพทย์ และเมืองที่ชอบ ไม่มีนายหน้า ไม่มีค่าธรรมเนียม",
    ctaLink: "รับรายชื่อส่วนตัว →",
  },
};

const FAQS = [
  {
    q: "What is the best city to retire in Thailand in 2026?",
    a: "Based on RealData's scoring of hospitals within 1km, air quality, transit access, and daily walkability: Phuket scores highest for beach-lifestyle retirees with good healthcare; Chiang Mai offers the best value and hospital density but has severe smoke season (Jan–Apr); Pattaya is best for budget retirees wanting a large expat community; Hua Hin has the cleanest air and quietest lifestyle. Bangkok has the best hospitals but worst air quality — ideal only for retirees needing regular specialist care.",
  },
  {
    q: "Do I need a visa to retire in Thailand?",
    a: "Thailand offers several long-stay visa options for retirees: the Non-Immigrant O-A (Retirement Visa, 1-year renewable, requires 800,000 THB in a Thai bank account or 65,000 THB/month income proof), and the newer Long-Term Resident (LTR) Visa (10 years, for retirees with passive income ≥ $40,000/year or health insurance + $80,000 savings). The LTR visa also allows a 50% income tax reduction on foreign-sourced income.",
  },
  {
    q: "Can foreigners own a condo in Thailand?",
    a: "Yes. Foreigners can own a condo freehold in Thailand under the Condominium Act, up to 49% of total floor area per building (the 'foreign quota'). There is no ownership time limit. Land cannot be owned — only leasehold (30+30+30 years) or through a Thai company. RealData tracks foreign quota availability for buildings across Phuket, Pattaya, Chiang Mai, and Bangkok.",
  },
  {
    q: "Which Thai city has the best hospitals for retirees?",
    a: "Bangkok has the most internationally accredited hospitals — Bumrungrad International, Samitivej, Bangkok Hospital — and is generally considered to have the best medical care in Southeast Asia. Outside Bangkok: Chiang Mai has the highest hospital density relative to its size (Chiang Mai Ram, Bangkok Hospital Chiang Mai, McCormick Hospital); Phuket has Bangkok Hospital Phuket and Phuket International Hospital (JCI-accredited); Pattaya has Bangkok Hospital Pattaya. Hua Hin has one major private hospital and requires a 3-hour trip to Bangkok for complex procedures.",
  },
  {
    q: "How is RealData's Retiree Score calculated?",
    a: "The Retiree Score (0–100) weights four factors: Healthcare 40% (hospitals within 1km from OpenStreetMap), Air Quality 25% (annual average AQI), Transit 20% (distance to nearest BTS/MRT/local transit hub), Daily Errands 15% (supermarkets within 1km). Only condos scoring ≥55 are shown as 'retirement suitable'. The score is computed for each condo individually and aggregated per city.",
  },
];

export default async function ThailandRetireeGuide({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = CONTENT[lang];
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;
  const supabase = getServerSupabase();

  // Fetch live retiree scores per city
  const cityScores: Record<string, CityScore | null> = {};
  for (const city of CITIES_DATA) {
    const { data } = await supabase
      .from("condos")
      .select("retiree_score")
      .in("province", city.dbSlugs)
      .gte("retiree_score", 55)
      .eq("is_active", true)
      .order("retiree_score", { ascending: false })
      .limit(100);
    const rows = data ?? [];
    if (rows.length < 3) {
      cityScores[city.slug] = null;
    } else {
      const scores = rows.map((r) => r.retiree_score as number);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      cityScores[city.slug] = {
        slug: city.slug,
        count: scores.length,
        avgScore: Math.round(avg * 10) / 10,
        topScore: scores[0],
      };
    }
  }

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t.h1,
    datePublished: PUBLISHED,
    dateModified: new Date().toISOString().slice(0, 10),
    author: { "@id": `${SITE_URL}/#org` },
    publisher: { "@id": `${SITE_URL}/#org` },
    mainEntityOfPage: POST_URL,
    description: META[lang as Lang].desc,
    inLanguage: lang,
    about: { "@type": "Country", name: "Thailand" },
    keywords: "retire Thailand, Thailand retirement, best city retire Thailand, LTR visa Thailand",
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogBreadcrumbs(lang, SLUG, t.h1)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(FAQS)) }} />

      <article className="space-y-10">
        {/* Header */}
        <header>
          <Link href={`/${lang}/blog`} className="text-zinc-500 text-xs hover:text-zinc-300">
            {t.backlink}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">{t.h1}</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            <time dateTime={PUBLISHED}>{PUBLISHED}</time> · {t.byline}
          </p>
          <div className="max-w-xs mt-4">
            <LinkShareButtons url={`${SITE_URL}/${lang}/blog/${SLUG}`} title={t.h1} />
          </div>
        </header>

        {/* Intro */}
        <div className="space-y-4 text-zinc-300 leading-relaxed">
          {t.intro.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {/* Live Score Cards */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-1">{t.scoreSectionTitle}</h2>
          <p className="text-zinc-500 text-xs mb-4">{t.scoreSectionLead}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {CITIES_DATA.map((city) => {
              const score = cityScores[city.slug];
              const cityName = city[lang as "en" | "ko" | "th"];
              const scoreColor = score
                ? score.avgScore >= 75 ? "text-emerald-400" : score.avgScore >= 55 ? "text-emerald-300" : "text-zinc-400"
                : "text-zinc-600";
              return (
                <div key={city.slug} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{cityName}</span>
                    {score ? (
                      <span className={`text-2xl font-black tabular-nums ${scoreColor}`}>{score.avgScore}</span>
                    ) : (
                      <span className="text-zinc-600 text-sm">—</span>
                    )}
                  </div>
                  {score ? (
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span>{score.count} {t.condosLabel}</span>
                      <span>{t.topScoreLabel}: <span className="text-emerald-400 font-semibold">{score.topScore}</span></span>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-600">
                      {lang === "ko" ? "데이터 처리 중" : lang === "th" ? "กำลังประมวลผลข้อมูล" : "Data processing"}
                    </div>
                  )}
                  <Link
                    href={`/${lang}${city.retireeLink}`}
                    className="mt-3 block text-xs text-blue-400 hover:text-blue-300"
                  >
                    {t.dataLinkLabel}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* City Breakdown */}
        <section className="space-y-8">
          <h2 className="text-lg font-bold">{t.citySectionTitle}</h2>
          {CITIES_DATA.map((city) => {
            const cityName = city[lang as "en" | "ko" | "th"];
            const pros = city.pros[lang as "en" | "ko" | "th"];
            const cons = city.cons[lang as "en" | "ko" | "th"];
            const bestFor = city.bestFor[lang as "en" | "ko" | "th"];
            const hospitals = lang === "th" ? city.hospitalsTh : city.hospitals;
            return (
              <div key={city.slug} className="border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="bg-zinc-900 px-5 py-4 flex items-center justify-between">
                  <h3 className="text-xl font-bold">{cityName}</h3>
                  <Link href={`/${lang}${city.retireeLink}`} className="text-xs text-blue-400 hover:text-blue-300">
                    {t.dataLinkLabel}
                  </Link>
                </div>
                <div className="divide-y divide-zinc-800/50">
                  <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/50">
                    <div className="px-5 py-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">{t.prosLabel}</div>
                      <ul className="space-y-1.5">
                        {pros.map((p, i) => (
                          <li key={i} className="text-sm text-zinc-300 flex gap-2">
                            <span className="text-emerald-400 shrink-0">+</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="px-5 py-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">{t.consLabel}</div>
                      <ul className="space-y-1.5">
                        {cons.map((c, i) => (
                          <li key={i} className="text-sm text-zinc-300 flex gap-2">
                            <span className="text-rose-400 shrink-0">−</span>{c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-zinc-950/50 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    <div>
                      <span className="text-zinc-500">{t.hospitalLabel}: </span>
                      <span className="text-zinc-300">{hospitals}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">{t.bestForLabel}: </span>
                      <span className="text-zinc-300 italic">{bestFor}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Quick reference table */}
        <section>
          <h2 className="text-lg font-bold mb-4">{t.verdictTitle}</h2>
          <div className="space-y-2">
            {t.verdictRows.map((r) => (
              <div key={r.city} className="flex gap-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm">
                <span className="font-semibold text-zinc-200 shrink-0 w-24">{r.city}</span>
                <span className="text-zinc-400 leading-relaxed">{r.verdict}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology */}
        <section className="pt-6 border-t border-zinc-900">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">{t.methodTitle}</h2>
          <ul className="space-y-1.5 text-zinc-400 text-sm leading-relaxed list-disc list-inside">
            {t.methodItems.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </section>

        {/* CTA */}
        <section className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-center space-y-3">
          <h2 className="font-bold text-lg">{t.ctaTitle}</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">{t.ctaBody}</p>
          <Link
            href={`/${lang}/contact`}
            className="inline-block mt-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition"
          >
            {t.ctaLink}
          </Link>
        </section>
      </article>
    </main>
  );
}
