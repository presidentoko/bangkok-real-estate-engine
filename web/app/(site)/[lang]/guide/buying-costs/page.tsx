import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

/* "thailand condo transfer fee", "thailand property tax for foreigners",
 * "leasehold vs freehold thailand" — informational queries portals ignore
 * because they sell listings. The costs live in several places on this site
 * (the ownership guide's tax list, the condo page's cost-of-ownership card);
 * this page is the one that adds them up on a real price. */

// Rates change only with government measures.
export const revalidate = 604800;

const PATH = "/guide/buying-costs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Buying costs — RealData" };
  const t = getDictionary(lang).buyingCosts;
  return {
    title: t.metaTitle,
    description: t.desc,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}${PATH}`, languages: langAlternates(PATH) },
    openGraph: ogFor(lang, {
      title: t.title,
      description: t.desc,
      url: `${SEO_SITE_URL}/${lang}${PATH}`,
      type: "article",
    }),
  };
}

export default async function BuyingCostsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.buyingCosts;

  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.guide.breadcrumb, href: `/${lang}/guide/investment` },
    { name: t.title, href: `/${lang}${PATH}` },
  ];

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(buildFaqJsonLd(t.faq)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            buildBreadcrumbsJsonLd(crumbs.map((c) => ({ name: c.name, url: `${SEO_SITE_URL}${c.href}` }))),
          ),
        }}
      />

      <header className="space-y-3">
        <Breadcrumbs items={crumbs} />
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.title}</h1>
      </header>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">{t.shortTitle}</h2>
        <p className="text-sm leading-relaxed text-zinc-200">{t.shortBody}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{t.tableTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4">{t.colItem}</th>
                <th className="py-2 pr-4">{t.colRate}</th>
                <th className="py-2 pr-4">{t.colWho}</th>
                <th className="py-2 pr-4">{t.colOn}</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.item} className="border-b border-zinc-900 align-top">
                  <td className="py-2 pr-4 text-zinc-200">{r.item}</td>
                  <td className="py-2 pr-4 text-emerald-400 whitespace-nowrap">{r.rate}</td>
                  <td className="py-2 pr-4 text-zinc-300">{r.who}</td>
                  <td className="py-2 pr-4 text-zinc-500">{r.on}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">{t.exampleTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.exampleBody}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-2xl font-bold">{t.annualTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.annualBody}</p>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.yieldNote}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-2xl font-bold">{t.tenureTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.tenureBody}</p>
      </section>

      <FaqSection items={t.faq} heading={t.faqTitle} />

      <section className="border-t border-zinc-800 pt-4 space-y-2 text-sm">
        <p className="text-zinc-500">{t.disclaimer}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={`/${lang}/guide/foreign-quota`} className="text-emerald-400 hover:underline">
            {t.seeQuota} →
          </Link>
          <Link href={`/${lang}/yields`} className="text-emerald-400 hover:underline">
            {t.seeYields} →
          </Link>
        </div>
      </section>
    </main>
  );
}
