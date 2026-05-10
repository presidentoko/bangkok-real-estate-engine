import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SLUG = "bangkok-overpriced-top10";
const PUBLISHED = "2026-05-06";

export const revalidate = 3600;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Top 10 Most Overpriced Bangkok Condos 2026 — Bubble Index Analysis | RealData",
    desc:
      "Data analysis of 1,003 Bangkok condos. Which buildings cost 3-4× the district average? Bubble Index ranking, district-by-district price comparison.",
    ogTitle: "Top 10 Most Overpriced Bangkok Condos — by Bubble Index",
    ogDesc: "Buildings priced 3-4× their district average. Independent measurement.",
  },
  ko: {
    title: "방콕 콘도 거품 TOP 10 — 데이터로 본 과대평가 2026 | RealData",
    desc:
      "1,003개 방콕 콘도의 가격을 같은 구역(khet) 중간값과 비교했습니다. 가장 거품이 큰 빌딩 10곳과 그 숫자.",
    ogTitle: "방콕 콘도 거품 TOP 10 — 데이터로 본 과대평가",
    ogDesc: "1,003개 방콕 콘도의 가격을 같은 구역 중간값과 비교한 거품 순위.",
  },
  th: {
    title: "10 อันดับคอนโดกรุงเทพราคาเกินจริงปี 2026 — Bubble Index | RealData",
    desc:
      "วิเคราะห์ข้อมูลคอนโดกรุงเทพ 1,003 อาคาร อาคารไหนแพงเกิน 3-4 เท่าของค่าเฉลี่ยเขต? อันดับ Bubble Index เปรียบเทียบราคารายเขต",
    ogTitle: "10 อันดับคอนโดกรุงเทพราคาเกินจริง — โดย Bubble Index",
    ogDesc: "อาคารที่ราคาเกินค่าเฉลี่ยเขต 3-4 เท่า ข้อมูลอิสระ",
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
      "Bangkok condo bubble", "overpriced Bangkok condo", "Bangkok condo prices 2026",
      "방콕 콘도 거품", "방콕 부동산 거품", "방콕 콘도 가격",
      "คอนโดกรุงเทพราคาเกิน", "ราคาคอนโดกรุงเทพ",
      "Sukhumvit condo overpriced", "98 Wireless price",
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
  name: string;
  region: string;
};

const CONTENT = {
  en: {
    backlink: "← Blog",
    h1: "Top 10 Most Overpriced Bangkok Condos",
    byline: "RealData analysis",
    intro: [
      "Bangkok has no shortage of condos that influencers push as ‘guaranteed appreciation.’ To audit those claims we pulled price data on every condo hipflat tracks (1,003 buildings) and compared each one to the median price-per-square-meter of its own district (khet).",
      "We call this the Bubble Index: building price/sqm ÷ district median price/sqm × 100. 100 = at market. 200 = double the average. 400 = four times the average.",
      "The 10 condos below are priced furthest above their district’s median. They are not necessarily bad buildings — luxury brand, location, or amenities can justify a premium. The point: know the number before you listen to the influencer.",
    ],
    tableHead: { rank: "#", condo: "Condo", district: "District", bubble: "Bubble Idx" },
    methodTitle: "Methodology",
    methodItems: [
      "Source: hipflat.co.th L3 page listings (price + floor area)",
      "Unit: USD per m²",
      "Each district’s building median normalised to 100",
      "Sale prices preferred; rent fallback for sale-less buildings",
      `Measurement date: ${PUBLISHED}`,
      "Districts with fewer than 5 sampled buildings excluded (small-sample noise)",
    ],
    methodFooter:
      "Data refreshes weekly. Click any building → per-unit prices, 13-month price trend, flood risk, nearby projects in one page.",
  },
  ko: {
    backlink: "← Blog",
    h1: "방콕 콘도 거품 TOP 10",
    byline: "RealData 분석",
    intro: [
      "방콕에는 인플루언서가 “무조건 오를 투자처”로 미는 콘도가 한둘이 아닙니다. 우리는 그 주장을 검증하기 위해 hipflat에 등재된 1,003개 빌딩의 가격 데이터를 같은 구(khet) 중간값과 비교했습니다.",
      "Bubble Index = 빌딩의 매물 평균 가격/면적 ÷ 같은 구의 매물 평균 가격/면적 × 100. 100이면 시세, 200이면 두 배 비쌈, 400이면 네 배 비쌈입니다.",
      "아래는 같은 구역 중간 가격 대비 가장 거품이 큰 10개 콘도입니다. 이들은 나쁜 빌딩이라는 뜻이 아닙니다 — 럭셔리 브랜드, 입지, 시설 때문에 프리미엄이 정당화될 수 있습니다. 다만, 인플루언서가 외친 “투자 가치”를 듣기 전에 이 숫자부터 알고 결정하라는 것이 우리의 입장입니다.",
    ],
    tableHead: { rank: "#", condo: "콘도", district: "구", bubble: "Bubble" },
    methodTitle: "방법론",
    methodItems: [
      "데이터 소스: hipflat.co.th L3 페이지에서 추출한 매물 가격/면적",
      "가격 단위: USD per m²",
      "같은 구(khet) 안의 모든 빌딩 가격/면적 중간값을 100으로 정규화",
      "SALE 가격 우선, SALE 데이터 없는 빌딩은 RENT 비교로 fallback",
      `측정 시점: ${PUBLISHED}`,
      "구역 표본 5건 미만은 제외 (작은 표본 노이즈 방지)",
    ],
    methodFooter:
      "데이터는 매주 갱신됩니다. 빌딩 클릭 → 매물별 시세, 13개월 가격 추이, 침수 위험, 인근 콘도까지 한 페이지에서.",
  },
  th: {
    backlink: "← Blog",
    h1: "10 อันดับคอนโดกรุงเทพราคาเกินจริง",
    byline: "การวิเคราะห์ของ RealData",
    intro: [
      "กรุงเทพมีคอนโดที่อินฟลูเอนเซอร์โปรโมตว่า “ราคาขึ้นแน่นอน” อยู่ไม่น้อย เพื่อตรวจสอบคำกล่าวอ้างเหล่านั้น เราได้ดึงข้อมูลราคาคอนโดทั้งหมดที่อยู่บน hipflat (1,003 อาคาร) และเปรียบเทียบแต่ละอาคารกับค่ามัธยฐานราคาต่อตารางเมตรของเขตเดียวกัน",
      "เราเรียกค่านี้ว่า Bubble Index: ราคา/ตร.ม. ของอาคาร ÷ ราคา/ตร.ม. ค่ามัธยฐานของเขต × 100 เท่ากับ 100 = ตามตลาด, 200 = แพงเป็นสองเท่า, 400 = แพงเป็นสี่เท่า",
      "10 อาคารด้านล่างมีราคาสูงกว่าค่ามัธยฐานของเขตมากที่สุด ไม่ได้แปลว่าอาคารเหล่านี้แย่ — แบรนด์ลักชัวรี่ ทำเล หรือสิ่งอำนวยความสะดวกอาจคุ้มกับเบี้ยพรีเมียม ประเด็นคือ: ก่อนที่จะฟังอินฟลูเอนเซอร์ ให้รู้ตัวเลขก่อน",
    ],
    tableHead: { rank: "#", condo: "คอนโด", district: "เขต", bubble: "Bubble" },
    methodTitle: "วิธีการ",
    methodItems: [
      "แหล่งข้อมูล: รายการประกาศจากหน้า L3 ของ hipflat.co.th (ราคา + พื้นที่)",
      "หน่วย: USD ต่อ ตร.ม.",
      "ค่ามัธยฐานของอาคารในแต่ละเขตปรับเป็น 100",
      "ใช้ราคาขายก่อน หากไม่มีข้อมูลขาย ใช้ราคาเช่าแทน",
      `วันที่วัด: ${PUBLISHED}`,
      "เขตที่มีตัวอย่างต่ำกว่า 5 อาคารถูกตัดออก (ลด noise จากตัวอย่างเล็ก)",
    ],
    methodFooter:
      "ข้อมูลอัพเดทรายสัปดาห์ คลิกอาคาร → ดูราคารายห้อง แนวโน้มราคา 13 เดือน ความเสี่ยงน้ำท่วม โครงการใกล้เคียง ทั้งหมดในหน้าเดียว",
  },
};

export default async function OverpricedTop10({
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
    .select("condo_id, bubble_index")
    .order("bubble_index", { ascending: false })
    .limit(10);

  const rows: Row[] = [];
  for (const s of (scores ?? []) as Array<{ condo_id: string; bubble_index: number }>) {
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
    author: { "@id": `${SITE_URL}/#org` },
    publisher: { "@id": `${SITE_URL}/#org` },
    mainEntityOfPage: POST_URL,
    description: META[lang].desc,
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
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
            {
              "@type": "PropertyValue",
              name: "RealData Bubble Index (district avg = 100)",
              value: r.bubble_index,
            },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogBreadcrumbs(lang, SLUG, t.h1)),
        }}
      />
      <article>
        <header className="mb-6">
          <Link href={`/${lang}/blog`} className="text-zinc-500 text-xs hover:text-zinc-300">
            {t.backlink}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
            {t.h1}
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">
            <time>{PUBLISHED}</time> · {t.byline}
          </p>
        </header>

        <section className="prose prose-invert prose-zinc max-w-none mb-6 text-zinc-300 space-y-4">
          {t.intro.map((p, i) => <p key={i}>{p}</p>)}
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider bg-zinc-950">
                <th className="font-normal py-3 pl-4 pr-2 w-10">{t.tableHead.rank}</th>
                <th className="font-normal py-3 pr-3">{t.tableHead.condo}</th>
                <th className="font-normal py-3 pr-3">{t.tableHead.district}</th>
                <th className="font-normal py-3 pr-4 text-right">{t.tableHead.bubble}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r, i) => (
                <tr key={r.condo_id} className="hover:bg-zinc-800/40">
                  <td className="py-3 pl-4 pr-2 font-mono text-zinc-500 tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-3 pr-3 font-semibold">
                    <Link
                      href={`/${lang}/condo/${r.condo_id}`}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-zinc-400">{r.region}</td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-rose-400">
                    {Math.round(r.bubble_index)}
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
          <p className="text-xs text-zinc-500">{t.methodFooter}</p>
        </section>
      </article>
    </main>
  );
}
