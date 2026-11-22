import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import {
  TEN_NUMBERS,
  TEN_NUMBERS_CITATION,
  TEN_NUMBERS_MEASURED,
  TEN_NUMBERS_PATH,
  TEN_NUMBERS_PUBLISHED,
} from "@/lib/tenNumbers";

/* A citable, dated snapshot for journalists, podcasts, forums and AI answers.
 * Every figure is fixed copy in lib/tenNumbers.ts: this page makes zero
 * database calls, and a quoted number never changes under its link. The
 * live pages each finding links to carry the current figure. */

export const revalidate = 604800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Bangkok condo market in 10 numbers — RealData" };
  const t = TEN_NUMBERS[lang];
  const url = `${SEO_SITE_URL}/${lang}${TEN_NUMBERS_PATH}`;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: url, languages: langAlternates(TEN_NUMBERS_PATH) },
    openGraph: ogFor(lang, {
      title: t.h1,
      description: t.metaDescription,
      url,
      type: "article",
      publishedTime: TEN_NUMBERS_PUBLISHED,
    }),
  };
}

export default async function TenNumbersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = TEN_NUMBERS[lang];
  const dict = getDictionary(lang);
  const url = `${SEO_SITE_URL}/${lang}${TEN_NUMBERS_PATH}`;

  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.dataShowcase.title, href: `/${lang}/data` },
    { name: t.h1, href: `/${lang}${TEN_NUMBERS_PATH}` },
  ];

  const org = { "@id": `${SEO_SITE_URL}/#org` };
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: t.h1,
    description: t.metaDescription,
    inLanguage: lang,
    url,
    mainEntityOfPage: url,
    datePublished: TEN_NUMBERS_PUBLISHED,
    dateModified: TEN_NUMBERS_PUBLISHED,
    author: org,
    publisher: org,
    isAccessibleForFree: true,
    image: `${SEO_SITE_URL}/${lang}/opengraph-image`,
    about: { "@type": "Place", name: "Bangkok, Thailand" },
    temporalCoverage: TEN_NUMBERS_MEASURED,
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.h1,
    numberOfItems: t.findings.length,
    itemListElement: t.findings.map((f, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${f.figure}: ${f.title}`,
      description: f.body,
      url: `${url}#n${i + 1}`,
    })),
  };
  const breadcrumbsJsonLd = buildBreadcrumbsJsonLd(
    crumbs.map((c) => ({ name: c.name, url: `${SEO_SITE_URL}${c.href}` })),
  );

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbsJsonLd) }} />

      <header className="space-y-3">
        <Breadcrumbs items={crumbs} />
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.h1}</h1>
        <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">{t.lead}</p>
        <p className="text-xs text-zinc-500">
          <time dateTime={TEN_NUMBERS_MEASURED}>{t.measuredLine}</time>
        </p>
      </header>

      <ol className="space-y-4">
        {t.findings.map((f, i) => (
          <li
            key={i}
            id={`n${i + 1}`}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 scroll-mt-20"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-zinc-500 text-xs tabular-nums w-5 shrink-0">{i + 1}</span>
              <div className="min-w-0 space-y-2">
                <div className="text-3xl sm:text-4xl font-black tabular-nums bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
                  {f.figure}
                </div>
                <h2 className="text-lg font-bold text-zinc-100">{f.title}</h2>
                <p className="text-sm text-zinc-300 leading-relaxed">{f.body}</p>
                <p className="text-xs text-zinc-500">
                  {t.sampleLabel}: {f.sample}
                </p>
                {f.link && f.linkLabel && (
                  <Link href={`/${lang}${f.link}`} className="inline-block text-sm text-emerald-400 hover:underline">
                    {f.linkLabel} →
                  </Link>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{t.methodTitle}</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-400 leading-relaxed">
          {t.method.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">{t.citeTitle}</h2>
        <p className="text-zinc-300 text-sm leading-relaxed">{t.citeBody}</p>
        <p className="text-zinc-100 text-sm font-semibold">
          {TEN_NUMBERS_CITATION}. <span className="text-zinc-400 font-normal break-all">{url}</span>
        </p>
      </section>
    </main>
  );
}
