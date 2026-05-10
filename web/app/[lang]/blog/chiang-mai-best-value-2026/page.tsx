import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLang, type Lang } from "@/lib/i18n";
import { blogBreadcrumbs, langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

const SITE_URL = SEO_SITE_URL;
const SLUG = "chiang-mai-best-value-2026";
const PUBLISHED = "2026-05-09";

export const revalidate = 3600;

const META: Record<Lang, { title: string; desc: string; ogTitle: string; ogDesc: string }> = {
  en: {
    title: "Chiang Mai Best-Value Condos 2026 — Digital Nomad + Retiree Picks | RealData",
    desc:
      "Underpriced Chiang Mai condos — Bubble Index < 90, ranked. For digital nomads, retirees, long-stay foreigners. Independent measurement, no broker fees.",
    ogTitle: "Chiang Mai Best-Value Condos — RealData picks",
    ogDesc: "Chiang Mai condos priced below the sub-area median. For long-stay foreigners and digital nomads.",
  },
  ko: {
    title: "치앙마이 저평가 콘도 BEST 2026 — 디지털 노마드 + 은퇴자 추천 | RealData",
    desc:
      "치앙마이에서 sub-area 평균보다 저평가된 콘도들. Bubble Index 90 미만 랭킹. 디지털 노마드, 은퇴자, 장기 체류 외국인용. 광고 없음.",
    ogTitle: "치앙마이 저평가 콘도 BEST",
    ogDesc: "치앙마이에서 sub-area 평균 미만으로 저평가된 콘도. 장기 체류용.",
  },
  th: {
    title: "คอนโดเชียงใหม่ราคาคุ้มค่าปี 2026 — สำหรับดิจิทัลโนแมดและผู้เกษียณ | RealData",
    desc:
      "คอนโดเชียงใหม่ราคาต่ำกว่าค่ามัธยฐานพื้นที่ย่อย Bubble Index < 90 จัดอันดับ สำหรับดิจิทัลโนแมด ผู้เกษียณ ชาวต่างชาติพำนักยาว ข้อมูลอิสระ",
    ogTitle: "คอนโดเชียงใหม่ราคาคุ้มค่า",
    ogDesc: "คอนโดเชียงใหม่ราคาต่ำกว่าค่ามัธยฐานพื้นที่ย่อย สำหรับชาวต่างชาติพำนักยาว",
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
      "Chiang Mai condo for sale", "Chiang Mai best value condo", "Chiang Mai digital nomad housing",
      "Chiang Mai retirement condo", "Chiang Mai foreign buyer", "Nimman condo prices",
      "치앙마이 콘도", "치앙마이 디지털 노마드", "치앙마이 은퇴 콘도",
      "คอนโดเชียงใหม่", "คอนโดนิมมาน",
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
  emptyState: string;
}> = {
  en: {
    backlink: "← Blog",
    h1: "Chiang Mai Best-Value Condos for Long-Stay Foreigners",
    byline: "RealData analysis",
    intro: [
      "Chiang Mai is the digital-nomad and retiree capital of Asia for a reason: cooler air than Bangkok, prices a fraction of Phuket, a real foreign-resident community, and visa rhythms that match a 1–10 year stay. The flip side is that 'cheap' is relative — within the city, Bubble Indexes still range from 70 to 200+.",
      "Below: Chiang Mai condos priced below their sub-area median (Bubble Index < 90). These are the buildings where, on the data alone, you're getting more square meter for your money than peers in the same neighborhood.",
      "Important: this is a price-vs-peer analysis only. We don't measure build quality, management responsiveness, or how loud the soi gets at 11pm. Use it as a shortlist, not a final answer.",
    ],
    tableHead: { rank: "#", condo: "Condo", district: "Sub-area", bubble: "Bubble" },
    methodTitle: "Methodology",
    methodItems: [
      "Data source: hipflat.co.th L3 listings (price + area per unit)",
      "Filter: Chiang Mai province only, Bubble Index < 90",
      "Sub-area median normalised to 100; sample required ≥ 5 buildings",
      "Sale price preferred; rent fallback when no sale data",
      `Measurement date: ${PUBLISHED}`,
    ],
    methodFooter:
      "Data refreshes weekly. Click any building → per-unit prices, 13-month price trend, nearby projects.",
    emptyState: "No buildings currently meet the Bubble Index < 90 threshold. Check back after the next weekly refresh.",
  },
  ko: {
    backlink: "← Blog",
    h1: "장기 체류 외국인용 치앙마이 저평가 콘도",
    byline: "RealData 분석",
    intro: [
      "치앙마이는 이유가 있어서 아시아 디지털 노마드·은퇴자의 수도입니다 — 방콕보다 서늘한 기후, 푸켓의 일부 가격, 진짜 외국인 거주 커뮤니티, 1~10년 체류에 맞는 비자 리듬. 다만 '싸다'는 건 상대적입니다. 도시 안에서도 Bubble Index가 70부터 200+까지 분포합니다.",
      "아래는 치앙마이 sub-area 중간값 미만으로 가격이 형성된 콘도들 (Bubble Index < 90). 데이터만 놓고 보면, 같은 동네 또래보다 평당 더 큰 평수를 얻는 빌딩들입니다.",
      "주의: 이건 가격 대 또래 분석뿐입니다. 시공 품질, 관리실 대응, 밤 11시 소이 소음 같은 건 측정하지 않습니다. 후보군 좁히기용, 최종 답 아님.",
    ],
    tableHead: { rank: "#", condo: "콘도", district: "Sub-area", bubble: "Bubble" },
    methodTitle: "방법론",
    methodItems: [
      "데이터 소스: hipflat.co.th L3 매물 가격/면적",
      "필터: 치앙마이 주 + Bubble Index 90 미만",
      "Sub-area 중간값 100으로 정규화, 표본 5건 이상",
      "SALE 가격 우선, 없으면 RENT",
      `측정 시점: ${PUBLISHED}`,
    ],
    methodFooter:
      "데이터는 매주 갱신됩니다. 빌딩 클릭 → 매물별 시세, 13개월 가격 추이, 인근 콘도까지.",
    emptyState: "현재 Bubble Index 90 미만 조건을 만족하는 빌딩 없음. 다음 주 갱신 후 다시 확인.",
  },
  th: {
    backlink: "← Blog",
    h1: "คอนโดเชียงใหม่ราคาคุ้มค่าสำหรับชาวต่างชาติพำนักยาว",
    byline: "การวิเคราะห์ของ RealData",
    intro: [
      "เชียงใหม่เป็นเมืองหลวงของดิจิทัลโนแมดและผู้เกษียณในเอเชียด้วยเหตุผล — อากาศเย็นกว่ากรุงเทพ ราคาเสี้ยวของภูเก็ต ชุมชนชาวต่างชาติจริง และจังหวะวีซ่าที่เข้ากับการอยู่ 1-10 ปี แต่ 'ถูก' เป็นเรื่องสัมพัทธ์ ภายในเมือง Bubble Index มีตั้งแต่ 70 ถึง 200+",
      "ด้านล่าง: คอนโดเชียงใหม่ที่ราคาต่ำกว่าค่ามัธยฐานพื้นที่ย่อย (Bubble Index < 90) มองจากข้อมูลล้วน คุณได้ตารางเมตรมากกว่าเพื่อนในย่านเดียวกัน",
      "ข้อสำคัญ: นี่คือการวิเคราะห์ราคาเทียบเพื่อนเท่านั้น เราไม่ได้วัดคุณภาพการก่อสร้าง การตอบสนองของฝ่ายจัดการ หรือเสียงในซอยตอน 5 ทุ่ม ใช้เป็นรายการคัดเลือก ไม่ใช่คำตอบสุดท้าย",
    ],
    tableHead: { rank: "#", condo: "คอนโด", district: "พื้นที่ย่อย", bubble: "Bubble" },
    methodTitle: "วิธีการ",
    methodItems: [
      "แหล่งข้อมูล: รายการประกาศ L3 ของ hipflat.co.th (ราคา + พื้นที่)",
      "ตัวกรอง: เฉพาะจังหวัดเชียงใหม่ + Bubble Index < 90",
      "ค่ามัธยฐานพื้นที่ย่อยปรับเป็น 100 ตัวอย่างต้อง ≥ 5 อาคาร",
      "ใช้ราคาขายก่อน หากไม่มีใช้ราคาเช่า",
      `วันที่วัด: ${PUBLISHED}`,
    ],
    methodFooter:
      "ข้อมูลอัพเดทรายสัปดาห์ คลิกอาคาร → ดูราคารายห้อง แนวโน้ม 13 เดือน คอนโดใกล้เคียง",
    emptyState: "ขณะนี้ยังไม่มีอาคารที่เข้าเงื่อนไข Bubble Index < 90 ตรวจสอบใหม่หลังการอัปเดตสัปดาห์หน้า",
  },
};

export default async function ChiangMaiBestValue({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = CONTENT[lang];
  const POST_URL = `${SITE_URL}/${lang}/blog/${SLUG}`;
  const supabase = getServerSupabase();

  const { data: cmCondos } = await supabase
    .from("condos_published")
    .select("id, name, regions(name)")
    .eq("province", "chiangmai")
    .limit(200);

  const cmIds = (cmCondos ?? []).map((c) => (c as { id: string }).id);
  const idToCondo = new Map(
    ((cmCondos ?? []) as unknown as Array<{
      id: string;
      name: string;
      regions: { name: string } | { name: string }[] | null;
    }>).map((c) => [c.id, c])
  );

  let rows: Row[] = [];
  if (cmIds.length) {
    const { data: scores } = await supabase
      .from("value_scores")
      .select("condo_id, bubble_index")
      .in("condo_id", cmIds)
      .lt("bubble_index", 90)
      .order("bubble_index", { ascending: true })
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
    dateModified: PUBLISHED,
    author: { "@id": `${SITE_URL}/#org` },
    publisher: { "@id": `${SITE_URL}/#org` },
    mainEntityOfPage: POST_URL,
    description: META[lang].desc,
    inLanguage: lang,
    about: { "@type": "Place", name: "Chiang Mai, Thailand" },
    mentions: rows.map((r) => ({
      "@type": "ApartmentComplex",
      name: r.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: r.region,
        addressRegion: "Chiang Mai",
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

        {rows.length === 0 ? (
          <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 text-sm">
            {t.emptyState}
          </div>
        ) : (
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
              {rows.map((r, i) => {
                const below = Math.round(100 - r.bubble_index);
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
                      <span className="font-bold tabular-nums text-emerald-400">
                        −{below}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

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
            href={`/${lang}/city/chiangmai`}
            className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            → All 58 Chiang Mai condos
          </Link>
        </section>
      </article>
    </main>
  );
}
