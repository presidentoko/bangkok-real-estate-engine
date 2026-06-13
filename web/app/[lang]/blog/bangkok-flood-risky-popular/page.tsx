import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL = SEO_SITE_URL;
const SLUG = "bangkok-flood-risky-popular";
const PUBLISHED = "2026-05-07";

export const revalidate = 3600;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Popular Bangkok Condos in High Flood-Risk Districts — 2026 Warning List | RealData",
    desc:
      "Bangkok condos with active listings in BMA flood Level 4-5 districts. Rainy season ankle to waist deep — buyers don't always know.",
    ogTitle: "Popular Bangkok Condos in High Flood-Risk Districts",
    ogDesc: "Active listings in BMA Level 4-5 flood zones. Verify before buying.",
  },
  ko: {
    title: "방콕 침수 위험 구역인데 매물 많은 콘도 2026 — 데이터로 본 위험 매수 | RealData",
    desc:
      "BMA 침수 위험 Level 4-5 구역에서 매물이 많이 나오는 콘도들. 우기마다 무릎까지 잠기는 동네인데 사람들은 모르고 사고 있습니다.",
    ogTitle: "방콕 침수 위험 구역인데 매물 많은 콘도",
    ogDesc: "BMA 침수 Level 4-5 구역에 자리한 인기 매물 빌딩.",
  },
  th: {
    title: "คอนโดยอดนิยมในเขตเสี่ยงน้ำท่วมสูงในกรุงเทพ — รายชื่อเตือนปี 2026 | RealData",
    desc:
      "คอนโดกรุงเทพที่มีประกาศจำนวนมากในเขตเสี่ยงน้ำท่วม Level 4-5 ของ กทม. หน้าฝนน้ำสูงระดับข้อเท้าถึงเอว แต่ผู้ซื้อมักไม่รู้",
    ogTitle: "คอนโดยอดนิยมในเขตเสี่ยงน้ำท่วมสูงในกรุงเทพ",
    ogDesc: "ประกาศที่ active ในเขตน้ำท่วม Level 4-5 ของ กทม. ตรวจสอบก่อนซื้อ",
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
      "Bangkok flood risk", "Bangkok flood map", "Don Mueang flood",
      "Bang Khen flood", "2011 Bangkok flood", "monsoon flood Bangkok",
      "방콕 침수", "방콕 우기 침수", "방콕 부동산 침수",
      "น้ำท่วมกรุงเทพ", "เขตเสี่ยงน้ำท่วม", "คอนโดน้ำท่วม",
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

type Row = {
  condo_id: string;
  name: string;
  region: string;
  flood_risk_level: number;
  listings_count: number;
};

const CONTENT = {
  en: {
    backlink: "← Blog",
    h1: "Popular Bangkok Condos in High Flood-Risk Districts",
    byline: "RealData warning list",
    floodMapAnchor: "Bangkok flood map",
    intro: [
      <>
        Some Bangkok districts go knee-deep every monsoon. The northern and eastern outskirts where the 2011 great flood started, plus the southern coastal khet built on tidal flats. We compiled a 0–5 risk score per district from BMA Drainage Department reports, JICA flood-mitigation studies, and 2011 inundation records — see the{" "}
        <Link href="/{LANG_PLACEHOLDER}/flood" className="underline">{`{FLOOD_LINK_LABEL}`}</Link>{" "}for the full map.
      </>,
      "And yet, condos in those Level 4-5 districts keep getting bought. Influencers and agents don't usually mention the flood part. We compiled the buildings with the most active listings inside high-risk districts, so you can verify before you buy.",
    ],
    tableHead: { rank: "#", condo: "Condo", district: "District", flood: "Flood", listings: "Listings" },
    methodTitle: "Methodology",
    methodItems: [
      "Flood risk: 0–5 score from BMA Drainage + JICA + 2011 great flood records (district level)",
      "Listings count: active sale + rent listings on hipflat",
      "Filter: flood Level 4+ AND 3+ active listings",
      "Sort: listings count descending (popularity)",
    ],
    methodFooter:
      "District-level baseline. Within the same district, road elevation and drainage vary — visit the site before purchase.",
  },
  ko: {
    backlink: "← Blog",
    h1: "방콕 침수 위험 구역인데 매물 많은 콘도",
    byline: "RealData 경고 리스트",
    floodMapAnchor: "방콕 침수 지도",
    intro: [
      <>
        방콕에는 우기마다 무릎까지 잠기는 동네가 있습니다. 2011년 대홍수가 시작된 외곽 북부와 동부, 그리고 갯벌 위에 세운 남부 해안. BMA(방콕 대도시청)가 매년 발표하는 위험도와 JICA 보고서를 종합해{" "}
        <Link href="/{LANG_PLACEHOLDER}/flood" className="underline">{`{FLOOD_LINK_LABEL}`}</Link>{" "}(50개 구) 점수를 만들었습니다.
      </>,
      "그런데 그런 침수 위험 4-5 구역에도 콘도 매물이 활발히 나옵니다. 인플루언서나 에이전트는 침수 사실을 굳이 강조하지 않습니다. 사기 전에 알아야 할 빌딩들을 데이터로 정리했습니다.",
    ],
    tableHead: { rank: "#", condo: "콘도", district: "구", flood: "침수", listings: "매물" },
    methodTitle: "방법론",
    methodItems: [
      "침수 위험: BMA + JICA + 2011년 대홍수 침수 범위 기반 0-5 점수 (구 단위)",
      "매물 수: hipflat에서 수집한 활성 listings (sale + rent)",
      "필터: 침수 L4 이상 + 매물 3건 이상",
      "정렬: 매물 수 내림차순 (인기 순)",
    ],
    methodFooter:
      "구 단위 베이스라인입니다. 같은 구 안에서도 도로 고도/배수 인프라에 따라 차이 있습니다. 매수 전 현장 답사 필수.",
  },
  th: {
    backlink: "← Blog",
    h1: "คอนโดยอดนิยมในเขตเสี่ยงน้ำท่วมสูงในกรุงเทพ",
    byline: "รายการเตือนของ RealData",
    floodMapAnchor: "แผนที่น้ำท่วมกรุงเทพ",
    intro: [
      <>
        บางเขตของกรุงเทพน้ำท่วมระดับเข่าทุกหน้าฝน — เขตตอนเหนือและตะวันออกที่น้ำท่วมใหญ่ปี 2554 เริ่มขึ้น และเขตชายฝั่งทางใต้ที่สร้างบนพื้นที่น้ำขึ้นน้ำลง เรารวบรวมคะแนนความเสี่ยง 0–5 ต่อเขตจากรายงานสำนักการระบายน้ำ กทม. รายงานบรรเทาน้ำท่วม JICA และบันทึกพื้นที่น้ำท่วมปี 2554 — ดู{" "}
        <Link href="/{LANG_PLACEHOLDER}/flood" className="underline">{`{FLOOD_LINK_LABEL}`}</Link>{" "}แผนที่ฉบับเต็ม
      </>,
      "แต่คอนโดในเขตระดับ 4-5 ก็ยังถูกซื้อต่อเนื่อง อินฟลูเอนเซอร์และเอเจนต์มักไม่พูดถึงเรื่องน้ำท่วม เรารวบรวมอาคารที่มีประกาศ active มากที่สุดในเขตเสี่ยงสูง เพื่อให้คุณตรวจสอบก่อนซื้อ",
    ],
    tableHead: { rank: "#", condo: "คอนโด", district: "เขต", flood: "น้ำท่วม", listings: "ประกาศ" },
    methodTitle: "วิธีการ",
    methodItems: [
      "ความเสี่ยงน้ำท่วม: คะแนน 0–5 จาก BMA + JICA + บันทึกน้ำท่วม 2554 (ระดับเขต)",
      "จำนวนประกาศ: ประกาศขาย+เช่า active บน hipflat",
      "ตัวกรอง: ระดับน้ำท่วม 4+ และมีประกาศ 3+",
      "เรียงลำดับ: จำนวนประกาศมากไปน้อย (ตามความนิยม)",
    ],
    methodFooter:
      "ระดับเขตเป็นเกณฑ์เบื้องต้น ภายในเขตเดียวกัน ระดับถนนและระบบระบายน้ำต่างกัน ควรเดินสำรวจสถานที่ก่อนซื้อ",
  },
};

export default async function FloodRiskyPost({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = CONTENT[lang];
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;
  const supabase = getServerSupabase();

  const PAGE = 1000;
  const condos: Array<{ id: string; name: string; regions: { name: string } | { name: string }[] | null }> = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("condos_published")
      .select("id, name, regions(name)")
      .eq("source", "hipflat")
      .range(offset, offset + PAGE - 1);
    const page = (data ?? []) as Array<{ id: string; name: string; regions: { name: string } | { name: string }[] | null }>;
    condos.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  const riskMap = new Map<string, number>();
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from("risk_factors")
      .select("condo_id, flood_risk_level")
      .range(offset, offset + PAGE - 1);
    const page = (data ?? []) as Array<{ condo_id: string; flood_risk_level: number | null }>;
    for (const p of page) {
      if (p.flood_risk_level != null) riskMap.set(p.condo_id, p.flood_risk_level);
    }
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  const listingsCount = new Map<string, number>();
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from("listings")
      .select("condo_id")
      .eq("source", "hipflat")
      .range(offset, offset + PAGE - 1);
    const page = (data ?? []) as Array<{ condo_id: string }>;
    for (const p of page) listingsCount.set(p.condo_id, (listingsCount.get(p.condo_id) ?? 0) + 1);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  const rows: Row[] = [];
  for (const c of condos) {
    const lvl = riskMap.get(c.id);
    const n = listingsCount.get(c.id) ?? 0;
    if (!lvl || lvl < 4 || n < 3) continue;
    const region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? "Bangkok";
    rows.push({
      condo_id: c.id,
      name: c.name,
      region,
      flood_risk_level: lvl,
      listings_count: n,
    });
  }
  rows.sort((a, b) => b.listings_count - a.listings_count);
  const top = rows.slice(0, 12);

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
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: top.length,
      itemListElement: top.map((r, i) => ({
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
            { "@type": "PropertyValue", name: "Flood Risk Level (0-5)", value: r.flood_risk_level },
            { "@type": "PropertyValue", name: "Active listings", value: r.listings_count },
          ],
        },
      })),
    },
  };

  // Render the intro paragraphs, swapping the LANG_PLACEHOLDER and label so
  // we can keep the JSX inline while still getting a per-locale flood-map link.
  const intro = t.intro.map((node, i) => {
    if (typeof node === "string") return <p key={i}>{node}</p>;
    return (
      <p key={i}>
        {/* node is a JSX fragment that already references the placeholder Link */}
        {node}
      </p>
    );
  });

  const faqJsonLd = buildFaqJsonLd([
    {
      q: "Which Bangkok areas have the worst flood risk for condo buyers?",
      a: "The Bangkok Metropolitan Administration (BMA) flood map designates Level 4–5 (highest risk) in northern and eastern districts including Don Mueang, Bang Khen, Lat Phrao, Min Buri, and Nong Chok. During heavy monsoon seasons these areas experience 30–80cm of standing water. Active condo listings exist in all these zones, often without flood disclosure.",
    },
    {
      q: "How does BMA rate flood risk in Bangkok?",
      a: "BMA uses a 1–5 scale based on historical flood depth and drainage capacity: Level 1 = no significant flood history; Level 2 = minor puddles; Level 3 = 10–30cm; Level 4 = 30–80cm; Level 5 = over 80cm. The 2011 mega-flood affected vast parts of Bangkok at Level 4–5. RealData maps all condos against this BMA dataset.",
    },
    {
      q: "Are condos in Bangkok flood zones cheaper?",
      a: "Not significantly. RealData analysis shows flood Level 4–5 condos often list near market price, as flood risk is rarely disclosed in listings. Buyers focused on central-Bangkok alternatives can filter for Level 1–2 areas first, then compare prices within those safer zones.",
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
          __html: JSON.stringify(blogBreadcrumbs(lang, SLUG, t.h1)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
          <FloodMapLinkedIntro lang={lang} content={t} />
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider bg-zinc-950">
                <th className="font-normal py-3 pl-4 pr-2 w-10">{t.tableHead.rank}</th>
                <th className="font-normal py-3 pr-3">{t.tableHead.condo}</th>
                <th className="font-normal py-3 pr-3">{t.tableHead.district}</th>
                <th className="font-normal py-3 pr-3 text-center">{t.tableHead.flood}</th>
                <th className="font-normal py-3 pr-4 text-right">{t.tableHead.listings}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {top.map((r, i) => (
                <tr key={r.condo_id} className="hover:bg-zinc-800/40">
                  <td className="py-3 pl-4 pr-2 font-mono text-zinc-500 tabular-nums">{i + 1}</td>
                  <td className="py-3 pr-3 font-semibold">
                    <Link href={`/${lang}/condo/${r.condo_id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 text-zinc-400">{r.region}</td>
                  <td className="py-3 pr-3 text-center tabular-nums">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        r.flood_risk_level === 5
                          ? "bg-red-900 text-red-100"
                          : "bg-orange-900 text-orange-100"
                      }`}
                    >
                      L{r.flood_risk_level}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold">
                    {r.listings_count}
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

// Per-lang intro that needs a contextual lang-aware <Link href="/<lang>/flood">
// embedded inside the prose. Done as a small component to keep the main
// CONTENT map plain data.
function FloodMapLinkedIntro({
  lang,
  content,
}: {
  lang: Lang;
  content: (typeof CONTENT)[Lang];
}) {
  const Anchor = (
    <Link href={`/${lang}/flood`} className="underline">
      {content.floodMapAnchor}
    </Link>
  );
  switch (lang) {
    case "en":
      return (
        <>
          <p>
            Some Bangkok districts go knee-deep every monsoon. The northern and
            eastern outskirts where the 2011 great flood started, plus the southern
            coastal khet built on tidal flats. We compiled a 0–5 risk score per
            district from BMA Drainage Department reports, JICA flood-mitigation
            studies, and 2011 inundation records — see the {Anchor} for the full map.
          </p>
          <p>
            And yet, condos in those Level 4-5 districts keep getting bought.
            Influencers and agents don&apos;t usually mention the flood part. We
            compiled the buildings with the most active listings inside high-risk
            districts, so you can verify before you buy.
          </p>
        </>
      );
    case "ko":
      return (
        <>
          <p>
            방콕에는 우기마다 무릎까지 잠기는 동네가 있습니다. 2011년 대홍수가
            시작된 외곽 북부와 동부, 그리고 갯벌 위에 세운 남부 해안. BMA(방콕
            대도시청)가 매년 발표하는 위험도와 JICA 보고서를 종합해{" "}{Anchor}
            {" "}(50개 구) 점수를 만들었습니다.
          </p>
          <p>
            그런데 그런 침수 위험 4-5 구역에도 콘도 매물이 활발히 나옵니다.
            인플루언서나 에이전트는 침수 사실을 굳이 강조하지 않습니다. 사기
            전에 알아야 할 빌딩들을 데이터로 정리했습니다.
          </p>
        </>
      );
    case "th":
      return (
        <>
          <p>
            บางเขตของกรุงเทพน้ำท่วมระดับเข่าทุกหน้าฝน — เขตตอนเหนือและตะวันออก
            ที่น้ำท่วมใหญ่ปี 2554 เริ่มขึ้น และเขตชายฝั่งทางใต้ที่สร้างบน
            พื้นที่น้ำขึ้นน้ำลง เรารวบรวมคะแนนความเสี่ยง 0–5 ต่อเขตจากรายงาน
            สำนักการระบายน้ำ กทม. รายงานบรรเทาน้ำท่วม JICA และบันทึกพื้นที่
            น้ำท่วมปี 2554 — ดู {Anchor} แผนที่ฉบับเต็ม
          </p>
          <p>
            แต่คอนโดในเขตระดับ 4-5 ก็ยังถูกซื้อต่อเนื่อง อินฟลูเอนเซอร์และ
            เอเจนต์มักไม่พูดถึงเรื่องน้ำท่วม เรารวบรวมอาคารที่มีประกาศ active
            มากที่สุดในเขตเสี่ยงสูง เพื่อให้คุณตรวจสอบก่อนซื้อ
          </p>
        </>
      );
  }
}
