import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { listWeeklyPosts } from "@/lib/weeklyPost";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "RealData Blog" };
  const t = getDictionary(lang);
  const title = lang === "en"
    ? "Bangkok Real Estate Blog — Condo Data, Flood Risk & Investment Guides | RealData"
    : `${t.blogIndex.title} — Bangkok property data analysis`;
  const description = lang === "en"
    ? "Data-driven Bangkok real estate analysis — flood risk rankings, bubble index breakdowns, rental yield comparisons, retiree guides, and foreign buyer handbooks. No influencer speculation, just numbers."
    : t.blogIndex.lead;
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/blog`,
      languages: langAlternates("/blog"),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}/blog`,
      type: "website",
    },
  };
}

// All posts are now translated to en / ko / th. Title/desc/tag come from
// per-lang maps; the post bodies are translated inline in each /blog/[slug]
// page via a CONTENT switch.
const POSTS = [
  {
    slug: "thailand-best-cities-for-retirees-2026",
    title: {
      en: "Best Cities to Retire in Thailand 2026 — Data Ranked",
      ko: "2026 태국 은퇴지 최고 도시 — 데이터 랭킹",
      th: "เมืองที่ดีที่สุดสำหรับเกษียณในไทย 2026 — จัดอันดับด้วยข้อมูล",
    },
    description: {
      en: "Healthcare, air quality, transit, walkability — we scored Phuket, Pattaya, Chiang Mai, Hua Hin, and Bangkok for retirees. No broker placement.",
      ko: "의료·공기질·교통·편의 4가지로 직접 점수 낸 태국 5개 도시 비교. 방콕, 푸켓, 파타야, 치앙마이, 후아힌.",
      th: "เปรียบเทียบ 5 เมืองไทย ด้วยข้อมูลด้านสุขภาพ อากาศ ขนส่ง และความสะดวก ภูเก็ต พัทยา เชียงใหม่ หัวหิน กรุงเทพ",
    },
    date: "2026-06-17",
    tag: { en: "Retiree", ko: "은퇴자", th: "ผู้เกษียณ" },
  },
  {
    slug: "phuket-bubble-watch",
    title: {
      en: "Phuket Bubble Watch — Top 10 Overpriced Condos",
      ko: "푸켓 콘도 거품 TOP 10",
      th: "10 อันดับคอนโดภูเก็ตราคาเกินจริง",
    },
    description: {
      en: "Data analysis of 63 Phuket condos. Which buildings cost 2-4× their sub-area average? Bubble Index ranking, Russian/Chinese-investor context.",
      ko: "푸켓 콘도 63채를 같은 sub-area 중간가와 비교. 거품 큰 빌딩 10곳 + 러시아·중국 투자자 맥락.",
      th: "วิเคราะห์คอนโดภูเก็ต 63 อาคาร อาคารไหนแพงเกิน 2-4 เท่าของพื้นที่ย่อย? อันดับ Bubble Index พร้อมบริบทนักลงทุนรัสเซีย/จีน",
    },
    date: "2026-05-09",
    tag: { en: "Bubble", ko: "거품", th: "ฟองสบู่" },
  },
  {
    slug: "chiang-mai-best-value-2026",
    title: {
      en: "Chiang Mai Best-Value Condos for Long-Stay Foreigners",
      ko: "장기 체류 외국인용 치앙마이 저평가 콘도",
      th: "คอนโดเชียงใหม่ราคาคุ้มค่าสำหรับชาวต่างชาติพำนักยาว",
    },
    description: {
      en: "Underpriced Chiang Mai condos — Bubble Index < 90 ranked. For digital nomads, retirees, long-stay foreigners. No broker fees, no influencer placement.",
      ko: "치앙마이 sub-area 평균 미만 저평가 콘도 랭킹. 디지털 노마드·은퇴자·장기 외국인 거주자용.",
      th: "คอนโดเชียงใหม่ราคาต่ำกว่าค่ามัธยฐานพื้นที่ย่อย Bubble Index < 90 จัดอันดับ สำหรับดิจิทัลโนแมด ผู้เกษียณ ชาวต่างชาติพำนักยาว",
    },
    date: "2026-05-09",
    tag: { en: "Picks", ko: "추천", th: "แนะนำ" },
  },
  {
    slug: "bangkok-foreign-buyer-guide-2026",
    title: {
      en: "Bangkok Condo Buyer Guide 2026 — Foreigner's Handbook",
      ko: "방콕 콘도 매수 가이드 2026 — 외국인 완전 핸드북",
      th: "คู่มือซื้อคอนโดกรุงเทพปี 2026 — สำหรับชาวต่างชาติ",
    },
    description: {
      en: "Complete guide: 49% quota rule, BTS proximity, central districts, flood risk, taxes, rental yield. Everything a foreign buyer should verify before signing.",
      ko: "완전 가이드: 49% 쿼터 규정, BTS 접근성, 중심 구역, 침수 위험, 세금, 임대 수익률. 외국인 매수자가 계약 전 확인해야 할 모든 것.",
      th: "คู่มือฉบับสมบูรณ์: กฎโควตา 49% ระยะ BTS เขตกลาง ความเสี่ยงน้ำท่วม ภาษี ผลตอบแทนค่าเช่า ทุกอย่างที่ผู้ซื้อต่างชาติต้องตรวจก่อนเซ็น",
    },
    date: "2026-05-07",
    tag: { en: "Guide", ko: "가이드", th: "คู่มือ" },
  },
  {
    slug: "sukhumvit-vs-sathorn-condo-comparison",
    title: {
      en: "Sukhumvit vs Sathorn vs Silom — Central Bangkok Condo Comparison",
      ko: "방콕 Sukhumvit vs Sathon vs Silom — 중심부 콘도 데이터 비교",
      th: "สุขุมวิท vs สาทร vs สีลม — เปรียบเทียบคอนโดกลางกรุงเทพ",
    },
    description: {
      en: "Data-backed median prices, BTS access, building count, flood profile across the three central condo corridors. Which corridor fits which strategy.",
      ko: "3대 중심 콘도 라인의 중간 가격, BTS 접근성, 빌딩 수, 침수 프로파일 데이터 비교. 어느 라인이 어느 전략에 맞는지.",
      th: "ราคามัธยฐาน ระยะ BTS จำนวนอาคาร โปรไฟล์น้ำท่วมของ 3 แนวคอนโดกลาง — แนวไหนเหมาะกับกลยุทธ์ไหน",
    },
    date: "2026-05-07",
    tag: { en: "Comparison", ko: "비교", th: "เปรียบเทียบ" },
  },
  {
    slug: "bangkok-flood-risky-popular",
    title: {
      ko: "방콕 침수 위험 구역인데 매물 많은 콘도",
      en: "Popular Bangkok condos in high flood-risk districts",
      th: "คอนโดยอดนิยมในเขตเสี่ยงน้ำท่วมสูงในกรุงเทพ",
    },
    description: {
      ko: "BMA 침수 위험 Level 4-5 구역에서 매물이 많이 나오는 빌딩들. 우기마다 무릎까지 잠기는 동네인데 사람들은 모르고 사고 있습니다.",
      en: "Bangkok buildings with active listings in BMA flood Level 4-5 districts. Rainy season ankle to waist deep — buyers don't always know.",
      th: "อาคารกรุงเทพที่มีประกาศจำนวนมากในเขตเสี่ยงน้ำท่วม Level 4-5 ของ กทม. หน้าฝนน้ำสูงระดับข้อเท้าถึงเอว แต่ผู้ซื้อมักไม่รู้",
    },
    date: "2026-05-07",
    tag: { ko: "리스크", en: "Risk", th: "ความเสี่ยง" },
  },
  {
    slug: "bangkok-foreigner-best-value",
    title: {
      ko: "외국인 투자자용 방콕 콘도 BEST",
      en: "Best Bangkok condos for foreign investors",
      th: "คอนโดกรุงเทพดีที่สุดสำหรับนักลงทุนต่างชาติ",
    },
    description: {
      ko: "Bubble Index 낮음 + Livability Score 높음 — 같은 평균 대비 저평가, 시설/교통 모두 상위 8개 빌딩.",
      en: "Low Bubble Index (underpriced vs district) + high Livability Score (BTS, hospitals, schools). 8 picks for the 49% foreign quota.",
      th: "Bubble Index ต่ำ (ต่ำกว่ามูลค่าเทียบเขต) + Livability Score สูง (BTS, รพ., โรงเรียน) คัดเลือก 8 อาคารสำหรับโควตาต่างชาติ 49%",
    },
    date: "2026-05-07",
    tag: { ko: "추천", en: "Picks", th: "แนะนำ" },
  },
  {
    slug: "bangkok-overpriced-top10",
    title: {
      ko: "방콕 콘도 거품 TOP 10 — 데이터로 본 과대평가",
      en: "Top 10 most overpriced Bangkok condos — Bubble Index analysis",
      th: "10 อันดับคอนโดกรุงเทพราคาเกินจริง — วิเคราะห์ด้วย Bubble Index",
    },
    description: {
      ko: "1,003개 빌딩의 가격 데이터를 분석. 같은 구역 평균 대비 가장 비싼 콘도들. 인플루언서가 안 알려주는 숫자.",
      en: "Analysis of 1,003 buildings — buildings priced 3-4× above their district average. The number influencers won't show you.",
      th: "วิเคราะห์อาคาร 1,003 หลัง — อาคารที่ราคาสูงกว่าค่าเฉลี่ยเขต 3-4 เท่า ตัวเลขที่อินฟลูเอนเซอร์ไม่ยอมบอก",
    },
    date: "2026-05-06",
    tag: { ko: "분석", en: "Analysis", th: "วิเคราะห์" },
  },
];

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const weeklyPosts = await listWeeklyPosts();

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="mb-2">
        <h1 className="text-3xl font-black mb-2">{t.blogIndex.title}</h1>
        <p className="text-zinc-400 text-sm max-w-xl">{t.blogIndex.lead}</p>
      </header>

      {weeklyPosts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Weekly auto-recap
          </h2>
          <ul className="space-y-3">
            {weeklyPosts.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/${lang}/blog/weekly/${p.slug}`}
                  className="block p-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition border border-emerald-500/30"
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                      Weekly{p.topic ? ` · ${p.topic}` : ""}
                    </span>
                    <time className="text-zinc-500 text-xs tabular-nums">
                      {p.published_at}
                    </time>
                  </div>
                  <h3 className="text-lg font-bold mt-1">{p.title}</h3>
                  <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                    {p.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-3">
        {POSTS.map((p) => {
          const title = (p.title as Record<string, string>)[lang] ?? p.title.en;
          const desc = (p.description as Record<string, string>)[lang] ?? p.description.en;
          const tag = (p.tag as Record<string, string>)[lang] ?? p.tag.en;
          return (
            <li key={p.slug}>
              <Link
                href={`/${lang}/blog/${p.slug}`}
                className="block p-5 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition border border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-pink-400 font-bold">
                    {tag}
                  </span>
                  <time className="text-zinc-500 text-xs tabular-nums">
                    {p.date}
                  </time>
                </div>
                <h2 className="text-lg font-bold mt-1">{title}</h2>
                <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{desc}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
