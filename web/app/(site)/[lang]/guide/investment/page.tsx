// web/app/[lang]/guide/investment/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd, type FaqItem } from "@/lib/seo/faqJsonLd";
import FaqSection from "@/components/FaqSection";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { getYieldByArea } from "@/lib/queries/areas";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 86400;


export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Investment guide — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.guide.investment.title} | RealData`,
    description: t.guide.investment.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/guide/investment`,
      languages: langAlternates(`/guide/investment`),
    },
    openGraph: ogFor(lang, { title: t.guide.investment.title, description: t.guide.investment.lead, url: `${SEO_SITE_URL}/${lang}/guide/investment`, type: "article" }),
  };
}

export default async function InvestmentPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const areas = await getYieldByArea();
  // Two nodes, not three: the old middle "Guides" crumb pointed at this very
  // URL, so the trail claimed the page was its own parent.
  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: t.guide.investment.title, href: `/${lang}/guide/investment` },
  ];
  const breadcrumbs = buildBreadcrumbsJsonLd(
    crumbs.map((c) => ({ name: c.name, url: `${SEO_SITE_URL}${c.href}` }))
  );
  return (
    <main className="max-w-4xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(buildFaqJsonLd(t.pageFaq.guideInvest)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbs) }} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-bold mb-2 mt-2">{t.guide.investment.title}</h1>
      <p className="text-zinc-400 mb-6">{t.guide.investment.lead}</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">{t.guide.investment.yieldTableTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4">{t.guide.investment.colArea}</th>
                <th className="py-2 pr-4">{t.guide.investment.colCondos}</th>
                <th className="py-2 pr-4">{t.guide.investment.colYield}</th>
                <th className="py-2 pr-4">{t.guide.investment.colPsm}</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.area} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-200">{a.area}</td>
                  <td className="py-2 pr-4 text-zinc-400">{a.condoCount}</td>
                  <td className="py-2 pr-4 text-emerald-400">{a.medianYieldPct != null ? `${a.medianYieldPct.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 pr-4 text-zinc-400">{a.medianPsm != null ? `฿${Math.round(a.medianPsm).toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Median of active-listing data, Bangkok areas with ≥5 tracked condos. Refreshed weekly.</p>
      </section>

      <article className="space-y-4 text-zinc-300 leading-relaxed">
        <p>Bangkok condo returns split into two levers: <Link className="text-blue-400" href={`/${lang}/glossary/gross-yield`}>gross rental yield</Link> and capital appreciation. The table above ranks areas by current yield; pair it with each building’s <Link className="text-blue-400" href={`/${lang}/glossary/bubble-index`}>Bubble Index</Link> to avoid overpaying. Foreign buyers should first read <Link className="text-blue-400" href={`/${lang}/guide/foreign-ownership`}>can foreigners buy a condo?</Link>.</p>
      </article>

      <FaqSection items={t.pageFaq.guideInvest} heading={t.home.faqTitle} className="mt-10" />
    </main>
  );
}
