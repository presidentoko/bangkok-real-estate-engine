import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { provinceDisplayName } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getForeignQuotaSummary } from "@/lib/queries/foreignQuota";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

/* The two questions Search Console showed us losing (2026-09-15):
 * "how to verify foreign ownership condominium quota" (position 62) and
 * "what happens if a condo building's 49% foreign quota is already full"
 * (position 36). /guide/foreign-ownership answered both only inside its FAQ,
 * under a title about whether foreigners can buy at all. This page is those
 * two answers, the documents behind them, and the foreign-quota inventory
 * we measure. */

// The legal text changes rarely; the inventory table moves weekly.
export const revalidate = 604800;

const PATH = "/guide/foreign-quota";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Foreign quota — RealData" };
  const t = getDictionary(lang).foreignQuota;
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

export default async function ForeignQuotaPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.foreignQuota;
  const summary = await getForeignQuotaSummary().catch(() => null);
  const fmt = (n: number) => n.toLocaleString(lang === "th" ? "th-TH" : lang === "ko" ? "ko-KR" : "en-US");

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

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">{t.shortTitle}</h2>
        <p className="text-sm leading-relaxed text-zinc-200">{t.shortVerify}</p>
        <p className="text-sm leading-relaxed text-zinc-200">{t.shortFull}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t.verifyTitle}</h2>
        <ol className="space-y-4">
          {t.verifySteps.map((step, i) => (
            <li key={step.h} className="flex gap-4">
              <span className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 text-zinc-200 text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-zinc-100">{step.h}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mt-1">{step.p}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t.fullTitle}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {t.fullOptions.map((o) => (
            <div key={o.h} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="font-semibold text-zinc-100">{o.h}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mt-1">{o.p}</p>
            </div>
          ))}
        </div>
      </section>

      {summary && summary.buildings > 0 && (
        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{t.dataTitle}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t.dataBody(fmt(summary.buildings), fmt(summary.plenty), fmt(summary.tight), summary.fetchedMonth)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-4">{t.colCity}</th>
                  <th className="py-2 pr-4">{t.colBuildings}</th>
                  <th className="py-2 pr-4">{t.colMedian}</th>
                  <th className="py-2 pr-4">{t.colPlenty}</th>
                  <th className="py-2 pr-4">{t.colTight}</th>
                </tr>
              </thead>
              <tbody>
                {summary.byCity.map((c) => (
                  <tr key={c.city} className="border-b border-zinc-900">
                    <td className="py-2 pr-4 text-zinc-200">{provinceDisplayName(c.city, lang)}</td>
                    <td className="py-2 pr-4 text-zinc-400 tabular-nums">{fmt(c.buildings)}</td>
                    <td className="py-2 pr-4 text-emerald-400 tabular-nums">{c.medianPct.toFixed(0)}%</td>
                    <td className="py-2 pr-4 text-zinc-300 tabular-nums">{Math.round((c.plenty / c.buildings) * 100)}%</td>
                    <td className="py-2 pr-4 text-zinc-300 tabular-nums">{Math.round((c.tight / c.buildings) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">{t.tableNote}</p>
        </section>
      )}

      <FaqSection items={t.faq} heading={t.faqTitle} />

      <section className="border-t border-zinc-800 pt-4 space-y-2 text-sm">
        <p className="text-zinc-500">{t.disclaimer}</p>
        <Link href={`/${lang}/guide/foreign-ownership`} className="text-emerald-400 hover:underline">
          {t.seeOwnership} →
        </Link>
      </section>
    </main>
  );
}
