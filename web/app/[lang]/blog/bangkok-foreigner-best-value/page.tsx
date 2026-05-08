import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, type Lang } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SLUG = "bangkok-foreigner-best-value";
const PUBLISHED = "2026-05-07";

export const revalidate = 3600;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Best Bangkok Condos for Foreign Investors 2026 — Data-Backed Picks | RealData",
    desc:
      "8 Bangkok condos with low Bubble Index (underpriced vs district) AND high Livability Score (BTS, hospitals, schools, supermarkets). For 49% foreign-quota buyers.",
    ogTitle: "Best Bangkok Condos for Foreign Investors — Data-Backed",
    ogDesc: "Underpriced + max amenity. Independent picks for foreign buyers.",
  },
  ko: {
    title: "외국인 투자자용 방콕 콘도 BEST 2026 — 데이터 기반 추천 | RealData",
    desc:
      "Bubble Index 낮음(저평가) + Livability Score 높음(시설/교통)을 만족하는 방콕 콘도 8개. 외국인 49% 쿼터 매수자용.",
    ogTitle: "외국인 투자자용 방콕 콘도 BEST — 데이터 기반",
    ogDesc: "저평가 + 시설 만점. 외국인 매수자를 위한 독립 추천.",
  },
  th: {
    title: "คอนโดกรุงเทพดีที่สุดสำหรับนักลงทุนต่างชาติ 2026 — ใช้ข้อมูลคัดเลือก | RealData",
    desc:
      "8 คอนโดกรุงเทพที่ Bubble Index ต่ำ (ต่ำกว่ามูลค่าเทียบเขต) + Livability Score สูง (BTS, รพ., โรงเรียน, ซูเปอร์มาร์เก็ต) สำหรับชาวต่างชาติที่ซื้อในโควตา 49%",
    ogTitle: "คอนโดกรุงเทพดีที่สุดสำหรับนักลงทุนต่างชาติ",
    ogDesc: "ต่ำกว่ามูลค่า + สิ่งอำนวยครบ คัดเลือกอิสระสำหรับชาวต่างชาติ",
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
      "Bangkok condo for foreigners", "best Bangkok condo investment", "foreign investor Bangkok",
      "Bangkok BTS condo", "Bangkok central condo guide", "49% foreign quota",
      "방콕 외국인 콘도", "방콕 콘도 추천", "방콕 부동산 투자",
      "คอนโดสำหรับชาวต่างชาติ", "ลงทุนคอนโดกรุงเทพ",
    ],
    alternates: {
      canonical: url,
      languages: {
        en: `${SITE_URL}/en/blog/${SLUG}`,
        ko: `${SITE_URL}/ko/blog/${SLUG}`,
        th: `${SITE_URL}/th/blog/${SLUG}`,
      },
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

type Row = {
  condo_id: string;
  bubble_index: number;
  asset_value_score: number;
  livability_score: number | null;
  name: string;
  region: string;
};

const CONTENT = {
  en: {
    backlink: "← Blog",
    h1: "Best Bangkok Condos for Foreign Investors",
    byline: "RealData picks",
    intro: [
      "The Bangkok condo market has plenty of buildings that genuinely make sense for a foreigner — and plenty that influencers push despite being mostly hype. We pulled price, amenity, and transit data on 1,003 buildings and filtered for the two conditions that actually matter:",
    ],
    criteriaList: [
      <>
        <strong>Underpriced</strong>: Bubble Index below 100 (priced under the district median for $/m²)
      </>,
      <>
        <strong>High amenity</strong>: Livability Score in the top tier — hospitals, schools, supermarkets within 1 km plus a nearby BTS/MRT station
      </>,
    ],
    afterCriteria: [
      "The 8 buildings below score highest on a combined ranking. Click a name for the full RealData report — per-unit prices, 13-month trend, flood risk, nearby projects.",
      "Note for foreign buyers: Thai law caps foreign ownership at 49% of the floor area in any single condo project. Confirm remaining quota with the project office or hipflat before committing.",
    ],
    tableHead: { rank: "#", condo: "Condo", district: "District", bubble: "Bubble", liv: "Liv" },
    methodTitle: "Methodology",
    methodItems: [
      "Bubble Index = building $/m² ÷ district median $/m² × 100",
      "Livability Score = (BTS/MRT distance + hospitals/schools/supermarkets within 1km) weighted",
      "asset_value_score = clamp(200 − Bubble Index, 0, 200) / 2",
      "Top 8 by asset score, restricted to buildings with Livability data",
      "Central districts preferred (Pathum Wan / Vadhana / Bang Rak / Sathon)",
    ],
  },
  ko: {
    backlink: "← Blog",
    h1: "외국인 투자자용 방콕 콘도 BEST",
    byline: "RealData 픽",
    intro: [
      "방콕 콘도 시장은 외국인이 살기에 정말 좋은 빌딩과, 인플루언서가 미는 비싸기만 한 빌딩이 섞여있습니다. 우리는 1,003개 빌딩의 가격·시설·교통 데이터를 모두 모아 다음 두 조건을 만족하는 빌딩을 골랐습니다:",
    ],
    criteriaList: [
      <>
        <strong>저평가</strong>: 같은 구(khet) 평균 가격/면적 대비 100 미만 (Bubble Index)
      </>,
      <>
        <strong>고시설</strong>: 1km 내 병원·학교·슈퍼마켓 + 인근 BTS/MRT (Livability Score 상위)
      </>,
    ],
    afterCriteria: [
      "점수가 가장 높은 8개를 추렸습니다. 빌딩 이름을 클릭하면 매물별 시세, 13개월 가격 추이, 침수 위험까지 한 페이지에 정리되어 있습니다.",
      "외국인 매수자 참고: 태국 법상 외국인은 한 콘도 단지의 최대 49% 면적까지 소유 가능합니다. 매수 전 잔여 쿼터를 프로젝트 사무소 또는 hipflat에서 확인하세요.",
    ],
    tableHead: { rank: "#", condo: "콘도", district: "구", bubble: "Bubble", liv: "Liv" },
    methodTitle: "방법론",
    methodItems: [
      "Bubble Index = 빌딩 매물 가격/면적 ÷ 같은 구 평균 가격/면적 × 100",
      "Livability Score = (BTS/MRT 거리 + 1km 내 병원/학교/슈퍼마켓 수) 가중합",
      "asset_value_score = clamp(200 − Bubble Index, 0, 200) / 2",
      "asset 점수 내림차순 + livability 데이터 보유 빌딩 중 상위 8",
      "외국인 신호: Pathum Wan / Vadhana / Bang Rak / Sathon 등 중심 구역 우선",
    ],
  },
  th: {
    backlink: "← Blog",
    h1: "คอนโดกรุงเทพดีที่สุดสำหรับนักลงทุนต่างชาติ",
    byline: "การคัดเลือกของ RealData",
    intro: [
      "ตลาดคอนโดกรุงเทพมีทั้งอาคารที่เหมาะกับชาวต่างชาติจริง ๆ และอาคารที่อินฟลูเอนเซอร์โปรโมตทั้งที่ไม่คุ้ม เราได้รวบรวมข้อมูลราคา สิ่งอำนวยความสะดวก และขนส่ง ของอาคาร 1,003 หลัง แล้วกรองตามเงื่อนไขสองข้อที่สำคัญจริง:",
    ],
    criteriaList: [
      <>
        <strong>ต่ำกว่ามูลค่า</strong>: Bubble Index ต่ำกว่า 100 (ราคา/ตร.ม. ต่ำกว่ามัธยฐานเขต)
      </>,
      <>
        <strong>สิ่งอำนวยครบ</strong>: Livability Score สูง — รพ./โรงเรียน/ซูเปอร์มาร์เก็ตในรัศมี 1 กม. + BTS/MRT ใกล้
      </>,
    ],
    afterCriteria: [
      "8 อาคารด้านล่างได้คะแนนรวมสูงสุด คลิกชื่ออาคารเพื่อดูรายงาน RealData ฉบับเต็ม — ราคารายห้อง แนวโน้ม 13 เดือน ความเสี่ยงน้ำท่วม โครงการใกล้เคียง",
      "หมายเหตุสำหรับผู้ซื้อต่างชาติ: กฎหมายไทยกำหนดให้ชาวต่างชาติเป็นเจ้าของได้สูงสุด 49% ของพื้นที่ในแต่ละโครงการ ตรวจสอบโควตาคงเหลือกับนิติบุคคลหรือ hipflat ก่อนตัดสินใจซื้อ",
    ],
    tableHead: { rank: "#", condo: "คอนโด", district: "เขต", bubble: "Bubble", liv: "Liv" },
    methodTitle: "วิธีการ",
    methodItems: [
      "Bubble Index = ราคา/ตร.ม. ของอาคาร ÷ ราคามัธยฐาน/ตร.ม. ของเขต × 100",
      "Livability Score = (ระยะ BTS/MRT + รพ./โรงเรียน/ซูเปอร์ในรัศมี 1 กม.) คะแนนถ่วง",
      "asset_value_score = clamp(200 − Bubble Index, 0, 200) / 2",
      "เรียงตาม asset score มากไปน้อย จำกัดเฉพาะอาคารที่มีข้อมูล Livability",
      "ให้น้ำหนักเขตกลาง (Pathum Wan / Vadhana / Bang Rak / Sathon)",
    ],
  },
};

export default async function BestValuePost({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = CONTENT[lang];
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;
  const supabase = getServerSupabase();

  const { data: scores } = await supabase
    .from("value_scores")
    .select("condo_id, bubble_index, asset_value_score, livability_score")
    .not("livability_score", "is", null)
    .order("asset_value_score", { ascending: false })
    .limit(15);

  const rows: Row[] = [];
  for (const s of (scores ?? []) as Array<{
    condo_id: string;
    bubble_index: number;
    asset_value_score: number;
    livability_score: number | null;
  }>) {
    if (rows.length >= 8) break;
    const { data } = await supabase
      .from("condos_published")
      .select("name, regions(name)")
      .eq("id", s.condo_id)
      .maybeSingle();
    if (!data) continue;
    const c = data as unknown as { name: string; regions: { name: string } | { name: string }[] | null };
    const region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? "Bangkok";
    rows.push({
      condo_id: s.condo_id,
      bubble_index: s.bubble_index,
      asset_value_score: s.asset_value_score,
      livability_score: s.livability_score,
      name: c.name,
      region,
    });
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: META[lang].ogTitle,
    inLanguage: lang,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    author: { "@type": "Organization", name: "RealData" },
    publisher: { "@type": "Organization", name: "RealData" },
    mainEntityOfPage: POST_URL,
    description: META[lang].desc,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "ApartmentComplex",
          name: r.name,
          address: {
            "@type": "PostalAddress",
            addressLocality: r.region,
            addressRegion: "Bangkok",
            addressCountry: "TH",
          },
          url: `${SITE_URL}/${lang}/condo/${r.condo_id}`,
          additionalProperty: [
            { "@type": "PropertyValue", name: "Bubble Index", value: r.bubble_index },
            { "@type": "PropertyValue", name: "Asset Value Score", value: r.asset_value_score },
            { "@type": "PropertyValue", name: "Livability Score", value: r.livability_score ?? 0 },
          ],
        },
      })),
    },
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <header className="mb-6">
          <Link href={`/${lang}/blog`} className="text-zinc-500 text-xs hover:text-zinc-300">
            {t.backlink}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">{t.h1}</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            <time>{PUBLISHED}</time> · {t.byline}
          </p>
        </header>

        <section className="prose prose-invert prose-zinc max-w-none mb-6 text-zinc-300 space-y-3">
          {t.intro.map((p, i) => <p key={i}>{p}</p>)}
          <ul>
            {t.criteriaList.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          {t.afterCriteria.map((p, i) => <p key={i}>{p}</p>)}
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider bg-zinc-950">
                <th className="font-normal py-3 pl-4 pr-2 w-10">{t.tableHead.rank}</th>
                <th className="font-normal py-3 pr-3">{t.tableHead.condo}</th>
                <th className="font-normal py-3 pr-3">{t.tableHead.district}</th>
                <th className="font-normal py-3 pr-3 text-right">{t.tableHead.bubble}</th>
                <th className="font-normal py-3 pr-4 text-right">{t.tableHead.liv}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r, i) => (
                <tr key={r.condo_id} className="hover:bg-zinc-800/40">
                  <td className="py-3 pl-4 pr-2 font-mono text-zinc-500 tabular-nums">{i + 1}</td>
                  <td className="py-3 pr-3 font-semibold">
                    <Link href={`/${lang}/condo/${r.condo_id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-zinc-400">{r.region}</td>
                  <td className="py-3 pr-3 text-right tabular-nums font-bold text-emerald-400">
                    {Math.round(r.bubble_index)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-sky-400">
                    {Math.round(r.livability_score ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8 prose prose-invert prose-zinc max-w-none text-zinc-300">
          <h2 className="text-xl font-bold">{t.methodTitle}</h2>
          <ul className="text-sm">
            {t.methodItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      </article>
    </main>
  );
}
