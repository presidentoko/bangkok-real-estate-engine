import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkShareButtons } from "@/components/LinkShareButtons";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL = SEO_SITE_URL;
const SLUG = "sukhumvit-vs-sathorn-condo-comparison";
const PUBLISHED = "2026-05-07";

export const revalidate = 3600;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Sukhumvit vs Sathorn vs Silom — Bangkok Central Condo Comparison 2026 | RealData",
    desc:
      "Data-backed comparison of Bangkok's three central condo corridors: Sukhumvit (Phrom Phong, Asok, Thonglor), Sathorn, Silom (Bang Rak). Median prices, BTS access, building counts, flood profile.",
    ogTitle: "Sukhumvit vs Sathorn vs Silom — Bangkok Condo Comparison",
    ogDesc: "Median price, BTS access, building counts. All three central districts compared.",
  },
  ko: {
    title: "방콕 Sukhumvit vs Sathon vs Silom — 중심부 콘도 데이터 비교 2026 | RealData",
    desc:
      "방콕 3대 중심 콘도 라인 비교: Sukhumvit(Phrom Phong, Asok, Thonglor), Sathon, Silom(Bang Rak). 중간 가격, BTS 접근성, 빌딩 수, 침수 프로파일.",
    ogTitle: "방콕 Sukhumvit vs Sathon vs Silom 콘도 비교",
    ogDesc: "중간 가격, BTS, 빌딩 수 — 3대 중심부 데이터 비교.",
  },
  th: {
    title: "สุขุมวิท vs สาทร vs สีลม — เปรียบเทียบคอนโดกลางกรุงเทพ 2026 | RealData",
    desc:
      "เปรียบเทียบโดยใช้ข้อมูลของ 3 แนวคอนโดกลางกรุงเทพ: สุขุมวิท (พร้อมพงษ์ อโศก ทองหล่อ) สาทร สีลม (บางรัก) ราคามัธยฐาน ระยะ BTS จำนวนอาคาร โปรไฟล์น้ำท่วม",
    ogTitle: "สุขุมวิท vs สาทร vs สีลม — เปรียบเทียบคอนโด",
    ogDesc: "ราคามัธยฐาน BTS จำนวนอาคาร เปรียบเทียบ 3 ย่านกลาง",
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
  const url = `${SITE_URL}/${useLang}/blog/${SLUG}`;
  return {
    title: m.title,
    description: m.desc,
    keywords: [
      "Sukhumvit condo", "Sathorn condo", "Silom condo", "Bang Rak condo",
      "Phrom Phong condo", "Asok condo", "Thonglor condo",
      "Bangkok central condo", "Bangkok condo comparison",
      "Bangkok district pricing", "Bangkok BTS condo prices",
      "Sukhumvit 콘도", "Sathon 콘도", "Silom 콘도",
      "방콕 중심부 콘도", "Phrom Phong 콘도", "방콕 콘도 비교",
      "คอนโดสุขุมวิท", "คอนโดสาทร", "คอนโดสีลม",
      "เปรียบเทียบคอนโดกลางกรุงเทพ",
    ],
    alternates: {
      canonical: url,
      languages: langAlternates(`/blog/${SLUG}`),
    },
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
      url,
      type: "article",
      publishedTime: PUBLISHED,
      locale: useLang,
    },
  };
}

// Districts that comprise each corridor. Slugs match what hipflat / our DB use.
const CORRIDORS = [
  {
    key: "sukhumvit",
    label: { en: "Sukhumvit", ko: "Sukhumvit", th: "สุขุมวิท" },
    districts: ["Vadhana", "Khlong Toei", "Phra Khanong", "vadhana", "khlong-toei", "phra-khanong"],
    bts: { en: "Phrom Phong / Asok / Thonglor / Ekkamai", ko: "Phrom Phong / Asok / Thonglor / Ekkamai", th: "พร้อมพงษ์ / อโศก / ทองหล่อ / เอกมัย" },
    floodLevel: 2,
  },
  {
    key: "sathorn",
    label: { en: "Sathorn", ko: "Sathon", th: "สาทร" },
    districts: ["Sathon", "sathon"],
    bts: { en: "Sala Daeng / Chong Nonsi / St. Louis", ko: "Sala Daeng / Chong Nonsi / St. Louis", th: "ศาลาแดง / ช่องนนทรี / เซนต์หลุยส์" },
    floodLevel: 1,
  },
  {
    key: "silom",
    label: { en: "Silom (Bang Rak)", ko: "Silom (Bang Rak)", th: "สีลม (บางรัก)" },
    districts: ["Bang Rak", "bang-rak"],
    bts: { en: "Sala Daeng / Surasak / Saphan Taksin", ko: "Sala Daeng / Surasak / Saphan Taksin", th: "ศาลาแดง / สุรศักดิ์ / สะพานตากสิน" },
    floodLevel: 1,
  },
];

type CorridorStat = {
  key: string;
  buildingCount: number;
  withSale: number;
  withRent: number;
  medianSale: number | null;
  medianRent: number | null;
  avgBubble: number | null;
};

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default async function CorridorComparison({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;

  const supabase = getServerSupabase();
  // Pull all condos with the columns we need to compute corridor stats.
  const { data: condos } = await supabase
    .from("condos_published")
    .select("id, regions(name), market_sale_median, market_rent_median, market_summary_currency")
    .eq("source", "hipflat")
    .range(0, 9999);

  const allRows = (condos ?? []) as unknown as Array<{
    id: string;
    regions: { name: string } | { name: string }[] | null;
    market_sale_median: number | null;
    market_rent_median: number | null;
    market_summary_currency: string | null;
  }>;

  // Pull bubble_index per condo id (separately to avoid triple-join cost).
  const { data: scores } = await supabase
    .from("value_scores")
    .select("condo_id, bubble_index")
    .range(0, 9999);
  const bubbleByCondo = new Map<string, number>();
  for (const s of (scores ?? []) as Array<{ condo_id: string; bubble_index: number | null }>) {
    if (s.bubble_index != null) bubbleByCondo.set(s.condo_id, s.bubble_index);
  }

  const stats: CorridorStat[] = CORRIDORS.map((corr) => {
    const buildings = allRows.filter((r) => {
      const region = (Array.isArray(r.regions) ? r.regions[0] : r.regions)?.name;
      return region != null && corr.districts.includes(region);
    });
    const sales = buildings
      .map((b) => b.market_sale_median)
      .filter((v): v is number => v != null);
    const rents = buildings
      .map((b) => b.market_rent_median)
      .filter((v): v is number => v != null);
    const bubbles = buildings
      .map((b) => bubbleByCondo.get(b.id))
      .filter((v): v is number => v != null);
    return {
      key: corr.key,
      buildingCount: buildings.length,
      withSale: sales.length,
      withRent: rents.length,
      medianSale: median(sales),
      medianRent: median(rents),
      avgBubble:
        bubbles.length > 0
          ? bubbles.reduce((a, b) => a + b, 0) / bubbles.length
          : null,
    };
  });
  const totalBuildings = stats.reduce((a, s) => a + s.buildingCount, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: META[lang].ogTitle,
    inLanguage: lang,
    datePublished: PUBLISHED,
    dateModified: new Date().toISOString().slice(0, 10),
    author: { "@id": `${SITE_URL}/#org` },
    publisher: { "@id": `${SITE_URL}/#org` },
    mainEntityOfPage: POST_URL,
    description: META[lang].desc,
  };

  const faqJsonLd = buildFaqJsonLd([
    {
      q: "Is Sukhumvit or Sathorn better for condo investment in Bangkok?",
      a: "The two corridors serve different investment profiles. Sukhumvit (Asok, Phrom Phong, Thonglor) has the highest rental demand from expats and tourists but also the highest entry prices. Sathorn offers slightly lower median prices with professional long-term tenant demand from the nearby financial district. Silom (Bang Rak) sits between both in price and tenant mix.",
    },
    {
      q: "What are median condo sale prices in Sukhumvit vs Sathorn in Bangkok?",
      a: "Based on RealData's analysis of active hipflat listings, Sukhumvit corridor condos (Vadhana, Khlong Toei, Phra Khanong) carry higher median sale prices per sqm than Sathorn, reflecting foreign-demand premiums and luxury developer concentration. Figures update weekly — see the full comparison table for current data.",
    },
    {
      q: "Which Bangkok central district has the lowest flood risk for condos?",
      a: "Sathorn and Silom (Bang Rak) rank at BMA flood Level 1 — no significant historical flooding. Sukhumvit corridor averages Level 2, with isolated pockets at Level 3 in lower Sukhumvit sois during extreme events. All three corridors are considerably safer than outer Bangkok districts like Don Mueang (Level 4–5).",
    },
  ]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogBreadcrumbs(lang, SLUG, META[lang].title)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <article>
        <header className="mb-6">
          <Link href={`/${lang}/blog`} className="text-zinc-500 text-xs hover:text-zinc-300">
            ← Blog
          </Link>
          <Body lang={lang} stats={stats} totalBuildings={totalBuildings} />
          <div className="max-w-xs mt-4">
            <LinkShareButtons url={POST_URL} title={META[lang].ogTitle} />
          </div>
        </header>
      </article>
    </main>
  );
}

function Body({
  lang,
  stats,
  totalBuildings,
}: {
  lang: Lang;
  stats: CorridorStat[];
  totalBuildings: number;
}) {
  const inv = (
    <Link href={`/${lang}/inventory`} className="underline">
      {lang === "ko" ? "전체 인벤토리" : lang === "th" ? "รายการอาคาร" : "full inventory"}
    </Link>
  );
  const picks = (
    <Link href={`/${lang}/blog/bangkok-foreigner-best-value`} className="underline">
      {lang === "ko" ? "외국인 BEST 추천" : lang === "th" ? "คัดเลือกสำหรับชาวต่างชาติ" : "best picks for foreigners"}
    </Link>
  );

  if (lang === "en") {
    return (
      <>
        <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
          Sukhumvit vs Sathorn vs Silom — Central Bangkok Condo Comparison
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          <time>{PUBLISHED}</time> · RealData analysis · {totalBuildings} buildings
        </p>

        <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
          <p>
            For most foreign buyers, &ldquo;central Bangkok&rdquo; means one of
            three corridors: Sukhumvit (Phrom Phong / Asok / Thonglor), Sathorn,
            or Silom / Bang Rak. They are walkable to BTS, low on flood risk,
            and command the city&apos;s highest condo prices. We pulled
            building-level data for all three and ran the medians side-by-side.
          </p>
        </section>

        <ComparisonTable stats={stats} lang={lang} />

        <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
          <h2 className="text-xl font-bold">Sukhumvit (Vadhana / Khlong Toei / Phra Khanong)</h2>
          <p>
            The largest of the three corridors by inventory. Phrom Phong and
            Thonglor concentrate luxury developments, while Ekkamai trends
            slightly younger and lower-priced. Sukhumvit sits at flood Level 2 —
            occasional puddling on heavy storms but no monsoon-scale issues.
            Foreign tenant demand is strongest here, especially Japanese, Korean,
            and Western expats clustered around Phrom Phong.
          </p>

          <h2 className="text-xl font-bold">Sathorn</h2>
          <p>
            Sathorn is the financial-district counterweight to Sukhumvit. It runs
            slightly older corporate-tenant heavy, with embassies and high-end
            offices anchoring rental demand. Flood Level 1 (lowest possible) and
            elevated land. Inventory is smaller than Sukhumvit, so per-unit
            prices can run high.
          </p>

          <h2 className="text-xl font-bold">Silom / Bang Rak</h2>
          <p>
            Bang Rak / Silom corridor connects to Sathorn and the Chao Phraya
            riverside. Mixed inventory of older walk-up buildings and newer
            high-rises. Flood Level 1. Smaller foreign-tenant pool than
            Sukhumvit but historically resilient prices.
          </p>

          <h2 className="text-xl font-bold mt-8">How to use this comparison</h2>
          <ul>
            <li>
              <strong>Maximum rental yield + foreign tenant pool</strong>:
              Sukhumvit (especially Phrom Phong, Asok)
            </li>
            <li>
              <strong>Lowest flood / longest-running asset</strong>: Sathorn
            </li>
            <li>
              <strong>Best price per BTS proximity</strong>: Silom / Bang Rak
            </li>
          </ul>
          <p>
            Browse the {inv} and filter by district to see every building in
            each corridor with its hero photo, Bubble Index, and flood badge.
            Or read our {picks}.
          </p>

          <p className="text-xs text-zinc-500 mt-6">
            Medians are USD per published hipflat snapshots. &ldquo;avg bubble&rdquo;
            is mean Bubble Index across buildings in the corridor with priced
            sale or rent listings (100 = at district average for $/m²).
          </p>
        </section>
      </>
    );
  }

  if (lang === "ko") {
    return (
      <>
        <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
          방콕 Sukhumvit vs Sathon vs Silom — 중심부 콘도 데이터 비교
        </h1>
        <p className="text-zinc-400 mt-2 text-sm">
          <time>{PUBLISHED}</time> · RealData 분석 · {totalBuildings}개 빌딩
        </p>

        <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
          <p>
            방콕 외국인 매수자 대부분에게 &ldquo;중심부&rdquo;는 세 라인 중
            하나입니다 — Sukhumvit(Phrom Phong / Asok / Thonglor), Sathon,
            Silom / Bang Rak. BTS 도보 거리, 침수 위험 낮음, 방콕 최고가
            콘도가 모여있는 라인입니다. 세 라인 빌딩 데이터를 모두 끌어와서
            중간값을 나란히 비교합니다.
          </p>
        </section>

        <ComparisonTable stats={stats} lang={lang} />

        <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
          <h2 className="text-xl font-bold">Sukhumvit (Vadhana / Khlong Toei / Phra Khanong)</h2>
          <p>
            세 라인 중 인벤토리가 가장 큽니다. Phrom Phong과 Thonglor가 럭셔리
            중심, Ekkamai는 좀 더 젊고 가격대 살짝 낮음. 침수 Level 2 — 폭우 때
            가끔 빗물 고임 정도, 우기 단위 침수는 없음. 외국인 임차 수요 가장
            강함 (특히 Phrom Phong 주변에 일본인·한국인·서양인 expat 밀집).
          </p>

          <h2 className="text-xl font-bold">Sathon</h2>
          <p>
            Sukhumvit의 금융지구 카운터파트. 약간 오래된 코퍼레이트 임차가 많고,
            대사관과 고급 오피스가 임대 수요를 안정화합니다. 침수 Level 1
            (최저), 고지대. 인벤토리가 Sukhumvit보다 작아서 unit별 가격은 높을 수
            있음.
          </p>

          <h2 className="text-xl font-bold">Silom / Bang Rak</h2>
          <p>
            Bang Rak / Silom은 Sathon과 차오프라야강 강변에 연결. 오래된
            워크업 빌딩과 최신 고층이 섞임. 침수 Level 1. Sukhumvit보다 외국인
            임차풀은 작지만 가격 회복력이 역사적으로 강함.
          </p>

          <h2 className="text-xl font-bold mt-8">이 비교 활용법</h2>
          <ul>
            <li>
              <strong>최고 임대 수익률 + 외국인 임차풀</strong>: Sukhumvit
              (특히 Phrom Phong, Asok)
            </li>
            <li>
              <strong>침수 위험 최저 / 자산 가장 안정</strong>: Sathon
            </li>
            <li>
              <strong>BTS 거리 대비 가성비</strong>: Silom / Bang Rak
            </li>
          </ul>
          <p>
            {inv}에서 구역 필터로 각 라인의 모든 빌딩 (사진 + Bubble Index +
            침수 배지) 보고, {picks} 글도 같이 참고.
          </p>

          <p className="text-xs text-zinc-500 mt-6">
            중간값은 hipflat이 게시한 USD 스냅샷 기준. &ldquo;avg bubble&rdquo;은
            해당 라인 내 매물 가격이 잡힌 빌딩들의 Bubble Index 평균 (100 =
            구 평균 $/m²과 같음).
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
        สุขุมวิท vs สาทร vs สีลม — เปรียบเทียบคอนโดกลางกรุงเทพ
      </h1>
      <p className="text-zinc-400 mt-2 text-sm">
        <time>{PUBLISHED}</time> · การวิเคราะห์ของ RealData · {totalBuildings} อาคาร
      </p>

      <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
        <p>
          สำหรับผู้ซื้อต่างชาติส่วนใหญ่ &ldquo;กลางกรุงเทพ&rdquo; หมายถึงหนึ่งใน
          สามแนว: สุขุมวิท (พร้อมพงษ์ / อโศก / ทองหล่อ) สาทร หรือ สีลม / บางรัก
          ทั้งสามเดินถึง BTS น้ำท่วมต่ำ และเป็นย่านราคาคอนโดสูงสุดของกรุงเทพ
          เรารวบรวมข้อมูลรายอาคารทั้งสามแนวและเปรียบเทียบค่ามัธยฐานคู่กัน
        </p>
      </section>

      <ComparisonTable stats={stats} lang={lang} />

      <section className="prose prose-invert prose-zinc max-w-none mt-8 text-zinc-300 space-y-4">
        <h2 className="text-xl font-bold">สุขุมวิท (วัฒนา / คลองเตย / พระโขนง)</h2>
        <p>
          แนวที่มีอาคารมากที่สุดในสามแนว พร้อมพงษ์และทองหล่อรวมโครงการลักชัวรี่
          เอกมัยจะอายุน้อยและราคาน้อยกว่าเล็กน้อย ระดับน้ำท่วม 2 — น้ำขังเป็น
          ครั้งคราวเมื่อฝนหนัก ไม่มีระดับมรสุม ความต้องการเช่าจากชาวต่างชาติ
          แข็งแกร่งที่สุด โดยเฉพาะกลุ่มญี่ปุ่น เกาหลี และตะวันตกที่อยู่รอบ
          พร้อมพงษ์
        </p>

        <h2 className="text-xl font-bold">สาทร</h2>
        <p>
          สาทรเป็นย่านการเงินที่เป็นคู่กันกับสุขุมวิท อาคารค่อนข้างเก่า ผู้เช่าเป็น
          องค์กรเป็นหลัก สถานทูตและออฟฟิศระดับสูงทำให้อุปสงค์เช่าเสถียร น้ำท่วม
          ระดับ 1 (ต่ำสุด) อยู่บนพื้นที่สูง อาคารน้อยกว่าสุขุมวิท ราคาต่อยูนิต
          จึงมักสูง
        </p>

        <h2 className="text-xl font-bold">สีลม / บางรัก</h2>
        <p>
          แนวบางรัก/สีลมเชื่อมกับสาทรและเจ้าพระยา อาคารผสมระหว่างวอล์คอัพเก่า
          และไฮไรส์ใหม่ น้ำท่วมระดับ 1 กลุ่มผู้เช่าต่างชาติเล็กกว่าสุขุมวิทแต่
          ราคามีความทนทานในประวัติศาสตร์
        </p>

        <h2 className="text-xl font-bold mt-8">วิธีใช้การเปรียบเทียบนี้</h2>
        <ul>
          <li>
            <strong>ผลตอบแทนเช่าสูงสุด + ผู้เช่าต่างชาติ</strong>: สุขุมวิท
            (โดยเฉพาะพร้อมพงษ์ อโศก)
          </li>
          <li>
            <strong>น้ำท่วมต่ำสุด / สินทรัพย์ทนยาวที่สุด</strong>: สาทร
          </li>
          <li>
            <strong>ราคา/ระยะ BTS คุ้มที่สุด</strong>: สีลม / บางรัก
          </li>
        </ul>
        <p>
          ค้นหาที่ {inv} กรองตามเขตเพื่อดูทุกอาคารในแต่ละแนว (ภาพ + Bubble
          Index + ป้ายน้ำท่วม) อ่าน {picks} เพิ่มเติม
        </p>

        <p className="text-xs text-zinc-500 mt-6">
          ค่ามัธยฐานคิดเป็น USD ตามสแนปช็อตของ hipflat &ldquo;avg bubble&rdquo;
          คือค่าเฉลี่ย Bubble Index ของอาคารในแนวที่มีประกาศราคา (100 =
          เท่ากับค่าเฉลี่ย/ตร.ม. ของเขต)
        </p>
      </section>
    </>
  );
}

function ComparisonTable({ stats, lang }: { stats: CorridorStat[]; lang: Lang }) {
  const labels = {
    en: {
      head: ["Corridor", "Buildings", "Median sale", "Median rent", "Avg Bubble", "Flood"],
    },
    ko: {
      head: ["라인", "빌딩", "매매 중간값", "월세 중간값", "평균 Bubble", "침수"],
    },
    th: {
      head: ["แนว", "อาคาร", "ขายมัธยฐาน", "เช่ามัธยฐาน", "Bubble เฉลี่ย", "น้ำท่วม"],
    },
  } as const;
  const t = labels[lang];
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto mt-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider bg-zinc-950">
            {t.head.map((h) => (
              <th key={h} className="font-normal py-3 px-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {stats.map((s, i) => {
            const corr = CORRIDORS[i];
            return (
              <tr key={s.key} className="hover:bg-zinc-800/40">
                <td className="py-3 px-3 font-semibold">
                  {corr.label[lang]}
                  <div className="text-[10px] text-zinc-500 font-normal mt-0.5">
                    BTS {corr.bts[lang]}
                  </div>
                </td>
                <td className="py-3 px-3 tabular-nums">{s.buildingCount}</td>
                <td className="py-3 px-3 tabular-nums">
                  {s.medianSale ? `USD ${Math.round(s.medianSale).toLocaleString()}` : "—"}
                </td>
                <td className="py-3 px-3 tabular-nums">
                  {s.medianRent ? `USD ${Math.round(s.medianRent).toLocaleString()}/mo` : "—"}
                </td>
                <td className="py-3 px-3 tabular-nums">
                  {s.avgBubble ? Math.round(s.avgBubble) : "—"}
                </td>
                <td className="py-3 px-3 tabular-nums">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      corr.floodLevel <= 1
                        ? "bg-emerald-900/40 text-emerald-300"
                        : "bg-lime-900/40 text-lime-300"
                    }`}
                  >
                    L{corr.floodLevel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
