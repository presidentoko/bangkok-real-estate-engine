import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL = SEO_SITE_URL;
const SLUG = "phuket-bubble-watch";
const PUBLISHED = "2026-05-09";

export const revalidate = 3600;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Phuket Bubble Watch 2026 — Top 10 Most Overpriced Condos | RealData",
    desc:
      "Data analysis of 63 Phuket condo buildings. Which buildings cost 2-4× the sub-area median? Bubble Index ranking with Russian/Chinese-investor context.",
    ogTitle: "Phuket Bubble Watch — Top 10 Overpriced Condos",
    ogDesc: "Phuket condos priced 2-4× their sub-area average. Independent measurement, no influencer placement.",
  },
  ko: {
    title: "푸켓 콘도 거품 TOP 10 — 데이터로 본 과대평가 2026 | RealData",
    desc:
      "푸켓 콘도 63채를 같은 sub-area(타몬) 중간가와 비교. 가장 거품 큰 빌딩 10곳. 러시아·중국 투자자 맥락 포함.",
    ogTitle: "푸켓 콘도 거품 TOP 10",
    ogDesc: "푸켓 콘도 63채 거품 분석. 같은 sub-area 대비 2~4배 비싼 빌딩들.",
  },
  th: {
    title: "10 อันดับคอนโดภูเก็ตราคาเกินจริง 2026 — Bubble Index | RealData",
    desc:
      "วิเคราะห์คอนโดภูเก็ต 63 อาคาร อาคารไหนแพงเกิน 2-4 เท่าของค่ามัธยฐานพื้นที่ย่อย? อันดับ Bubble Index พร้อมบริบทนักลงทุนรัสเซีย/จีน",
    ogTitle: "10 อันดับคอนโดภูเก็ตราคาเกินจริง",
    ogDesc: "คอนโดภูเก็ตราคาเกินค่าเฉลี่ยพื้นที่ย่อย 2-4 เท่า ข้อมูลอิสระ",
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
      "Phuket condo bubble", "Phuket overpriced condo", "Phuket condo investment 2026",
      "Phuket Russian buyers", "Patong condo prices", "Kathu condo investment",
      "푸켓 콘도 거품", "푸켓 부동산", "푸켓 콘도 가격",
      "คอนโดภูเก็ตราคาเกิน", "ราคาคอนโดภูเก็ต",
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

type Row = {
  condo_id: string;
  bubble_index: number;
  name: string;
  region: string;
};

const CONTENT: Record<Lang, {
  backlink: string;
  h1: string;
  byline: string;
  intro: string[];
  tableHead: { rank: string; condo: string; district: string; bubble: string };
  methodTitle: string;
  methodItems: string[];
  methodFooter: string;
}> = {
  en: {
    backlink: "← Blog",
    h1: "Phuket Bubble Watch — Top 10 Overpriced Condos",
    byline: "RealData analysis",
    intro: [
      "Phuket's condo market is shaped by foreign demand: Russian buyers post-2022, Chinese capital, Western retirees, and Bangkok investors looking for vacation-rental yield. Marketing decks lean heavily on 'beachfront premium' and 'guaranteed yield' — without putting a number on either.",
      "We crawled all 63 Phuket condo buildings on hipflat, computed each building's median price-per-sqm, then divided by its sub-area (tambon) median to produce a Bubble Index. 100 = at-market. 200 = double the local average. 400 = four times.",
      "Below: the 10 highest-Bubble-Index buildings in Phuket. These aren't necessarily bad buildings — luxury brands, beach proximity, or amenities can justify a real premium. The point is: before you pay the 'investment' pitch, know the number.",
    ],
    tableHead: { rank: "#", condo: "Condo", district: "Sub-area", bubble: "Bubble" },
    methodTitle: "Methodology",
    methodItems: [
      "Data source: hipflat.co.th L3 listings (price + area per unit)",
      "Price unit: USD per m²",
      "Sub-area median normalised to 100",
      "SALE price preferred; RENT fallback when no sale data",
      `Measurement date: ${PUBLISHED}`,
      "Sub-areas with fewer than 5 sampled buildings excluded (small-sample noise)",
    ],
    methodFooter:
      "Data refreshes weekly. Click any building → per-unit prices, 13-month price trend, nearby projects in one page.",
  },
  ko: {
    backlink: "← Blog",
    h1: "푸켓 콘도 거품 TOP 10",
    byline: "RealData 분석",
    intro: [
      "푸켓 콘도 시장은 외국인 수요로 형성됩니다 — 2022년 이후 러시아인, 중국 자본, 서양 은퇴자, 휴양 임대 수익을 찾는 방콕 투자자. 마케팅 자료는 '해변 프리미엄'과 '확정 수익'을 외치지만 숫자는 없습니다.",
      "hipflat에 등재된 푸켓 콘도 63개 빌딩의 매물 가격/면적 중간값을 계산하고, 같은 sub-area(타몬) 중간값으로 나눈 Bubble Index를 산출했습니다. 100=시세, 200=두 배, 400=네 배.",
      "아래는 푸켓에서 가장 Bubble Index가 높은 10개 빌딩입니다. 럭셔리 브랜드, 해변 인접성, 시설 때문에 정당한 프리미엄일 수 있습니다 — 다만 '투자 가치' 피치를 듣기 전에 이 숫자부터 알라는 게 우리 입장입니다.",
    ],
    tableHead: { rank: "#", condo: "콘도", district: "Sub-area", bubble: "Bubble" },
    methodTitle: "방법론",
    methodItems: [
      "데이터 소스: hipflat.co.th L3 매물 가격/면적",
      "가격 단위: USD per m²",
      "Sub-area 중간값을 100으로 정규화",
      "SALE 가격 우선, 없으면 RENT 비교",
      `측정 시점: ${PUBLISHED}`,
      "Sub-area 표본 5건 미만은 제외",
    ],
    methodFooter:
      "데이터는 매주 갱신됩니다. 빌딩 클릭 → 매물별 시세, 13개월 가격 추이, 인근 콘도까지 한 페이지에서.",
  },
  th: {
    backlink: "← Blog",
    h1: "10 อันดับคอนโดภูเก็ตราคาเกินจริง",
    byline: "การวิเคราะห์ของ RealData",
    intro: [
      "ตลาดคอนโดภูเก็ตขับเคลื่อนด้วยดีมานด์ต่างชาติ — รัสเซียหลัง 2022, จีน, ผู้เกษียณตะวันตก และนักลงทุนกรุงเทพที่มองหาผลตอบแทนเช่ารายวัน วาทกรรมการตลาดเน้น 'พรีเมียมหน้าหาด' และ 'ผลตอบแทนรับประกัน' โดยไม่ระบุตัวเลข",
      "เราดึงข้อมูลคอนโดภูเก็ตทั้ง 63 อาคารบน hipflat คำนวณค่ามัธยฐานราคาต่อตารางเมตรของแต่ละอาคาร แล้วหารด้วยค่ามัธยฐานพื้นที่ย่อย (ตำบล) เพื่อหา Bubble Index 100 = ตามตลาด, 200 = สองเท่า, 400 = สี่เท่า",
      "ด้านล่าง: 10 อาคารที่มี Bubble Index สูงสุดในภูเก็ต ไม่ได้แปลว่าอาคารแย่ — แบรนด์ลักชัวรี่ ระยะหาด หรือสิ่งอำนวยความสะดวกอาจคุ้มกับเบี้ยพรีเมียม ประเด็นคือ: ก่อนเชื่อข้อเสนอ 'มูลค่าการลงทุน' ให้รู้ตัวเลขก่อน",
    ],
    tableHead: { rank: "#", condo: "คอนโด", district: "พื้นที่ย่อย", bubble: "Bubble" },
    methodTitle: "วิธีการ",
    methodItems: [
      "แหล่งข้อมูล: รายการประกาศ L3 ของ hipflat.co.th (ราคา + พื้นที่)",
      "หน่วย: USD ต่อ ตร.ม.",
      "ค่ามัธยฐานพื้นที่ย่อยปรับเป็น 100",
      "ใช้ราคาขายก่อน หากไม่มีใช้ราคาเช่าแทน",
      `วันที่วัด: ${PUBLISHED}`,
      "พื้นที่ย่อยที่มีตัวอย่างต่ำกว่า 5 อาคารถูกตัดออก",
    ],
    methodFooter:
      "ข้อมูลอัพเดทรายสัปดาห์ คลิกอาคาร → ดูราคารายห้อง แนวโน้ม 13 เดือน คอนโดใกล้เคียง ทั้งหมดในหน้าเดียว",
  },
};

export default async function PhuketBubbleWatch({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = CONTENT[lang];
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;
  const supabase = getServerSupabase();

  // Get top-10 Phuket condos by bubble_index. Filter on the client side
  // because value_scores doesn't carry province; we join via condos.province.
  const { data: phuketCondos } = await supabase
    .from("condos_published")
    .select("id, name, regions(name)")
    .eq("province", "phuket")
    .limit(200);

  const phuketIds = (phuketCondos ?? []).map((c) => (c as { id: string }).id);
  const idToCondo = new Map(
    ((phuketCondos ?? []) as unknown as Array<{
      id: string;
      name: string;
      regions: { name: string } | { name: string }[] | null;
    }>).map((c) => [c.id, c])
  );

  let rows: Row[] = [];
  if (phuketIds.length) {
    const { data: scores } = await supabase
      .from("value_scores")
      .select("condo_id, bubble_index")
      .in("condo_id", phuketIds)
      .order("bubble_index", { ascending: false })
      .limit(10);
    rows = ((scores ?? []) as Array<{ condo_id: string; bubble_index: number }>)
      .map((s) => {
        const c = idToCondo.get(s.condo_id);
        if (!c) return null;
        const region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? "—";
        return { condo_id: s.condo_id, bubble_index: s.bubble_index, name: c.name, region };
      })
      .filter((x): x is Row => x !== null);
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
    description: META[lang].desc,
    inLanguage: lang,
    about: { "@type": "Place", name: "Phuket, Thailand" },
    mentions: rows.map((r) => ({
      "@type": "ApartmentComplex",
      name: r.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: r.region,
        addressRegion: "Phuket",
        addressCountry: "TH",
      },
      additionalProperty: [
        { "@type": "PropertyValue", name: "RealData Bubble Index", value: r.bubble_index },
      ],
    })),
    isPartOf: {
      "@type": "ItemList",
      itemListElement: rows.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/${lang}/condo/${r.condo_id}`,
        name: r.name,
      })),
    },
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogBreadcrumbs(lang, SLUG, t.h1)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqJsonLd([
            {
              q: "What is the Phuket condo Bubble Index?",
              a: "RealData's Bubble Index measures each condo building's median sale price per sqm relative to its sub-area (tambon) median. 100 = at market. 200 = priced double the local average. In Phuket, buildings catering to foreign vacation-rental buyers — particularly in Patong, Kata, and Kamala — often score 150–350, reflecting the beach-proximity premium.",
            },
            {
              q: "Who buys overpriced condos in Phuket?",
              a: "Phuket's premium condo market is driven by Russian buyers (particularly post-2022), Chinese investors, Western retirees seeking vacation homes, and Bangkok investors targeting vacation-rental income. Marketing materials emphasize 'guaranteed yield' and 'beachfront premium' without publishing specific numbers — this analysis supplies those numbers.",
            },
            {
              q: "How do you measure if a Phuket condo is overpriced?",
              a: "RealData crawls all hipflat.co.th listings for each Phuket condo building, computes the median price per square meter, then divides by the sub-area (tambon) median. Buildings with fewer than 5 sampled properties per sub-area are excluded. Sale prices are preferred; rent data is used as fallback when no sale listings exist.",
            },
          ])),
        }}
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

        <div className="space-y-4 text-zinc-300 leading-relaxed">
          {t.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <table className="w-full mt-8 text-sm border-collapse">
          <thead className="text-zinc-400 text-[11px] uppercase tracking-wider border-b border-zinc-800">
            <tr>
              <th className="text-left py-2 font-semibold">{t.tableHead.rank}</th>
              <th className="text-left py-2 font-semibold">{t.tableHead.condo}</th>
              <th className="text-left py-2 font-semibold">{t.tableHead.district}</th>
              <th className="text-right py-2 font-semibold">{t.tableHead.bubble}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-500 text-sm">
                  {lang === "ko"
                    ? "푸켓 Bubble Index 계산 중 — 곧 업데이트됩니다."
                    : lang === "th"
                    ? "กำลังคำนวณ Bubble Index ภูเก็ต — จะอัพเดทเร็วๆ นี้"
                    : "Phuket Bubble Index computing — check back shortly."}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const above = Math.round(r.bubble_index - 100);
                return (
                  <tr key={r.condo_id} className="border-b border-zinc-900">
                    <td className="py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                    <td className="py-3">
                      <Link
                        href={`/${lang}/condo/${r.condo_id}`}
                        className="text-zinc-100 hover:text-blue-300 transition"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-3 text-zinc-400 text-xs">{r.region}</td>
                    <td className="py-3 text-right">
                      <span
                        className={`font-bold tabular-nums ${
                          above > 100 ? "text-rose-400" : above > 30 ? "text-orange-400" : "text-zinc-300"
                        }`}
                      >
                        +{above}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <section className="mt-10 pt-6 border-t border-zinc-900">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">
            {t.methodTitle}
          </h2>
          <ul className="space-y-1.5 text-zinc-400 text-sm leading-relaxed list-disc list-inside">
            {t.methodItems.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <p className="text-zinc-500 text-xs mt-4 italic">{t.methodFooter}</p>
          <Link
            href={`/${lang}/city/phuket`}
            className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            → All 63 Phuket condos
          </Link>
        </section>
      </article>
    </main>
  );
}
