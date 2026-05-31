// web/app/[lang]/glossary/[term]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildDefinedTermJsonLd } from "@/lib/seo/definedTermJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { GLOSSARY, getTerm } from "@/lib/glossary";

export const revalidate = 86400;

export function generateStaticParams() {
  return GLOSSARY.flatMap((g) => LANGS.map((lang) => ({ lang, term: g.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; term: string }> }): Promise<Metadata> {
  const { lang, term } = await params;
  const g = getTerm(term);
  if (!isLang(lang) || !g) return { title: "Glossary — RealData" };
  return {
    title: `${g.term} — definition & how it's calculated | RealData`,
    description: g.definition,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}/glossary/${term}`, languages: langAlternates(`/glossary/${term}`) },
  };
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ lang: string; term: string }> }) {
  const { lang, term } = await params;
  if (!isLang(lang)) notFound();
  const g = getTerm(term);
  if (!g) notFound();
  const t = getDictionary(lang);
  const jsonLd = buildDefinedTermJsonLd({
    term: g.term,
    definition: g.definition,
    url: `${SEO_SITE_URL}/${lang}/glossary/${g.slug}`,
    inSetUrl: `${SEO_SITE_URL}/${lang}/glossary`,
  });
  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.glossary.breadcrumb, url: `${SEO_SITE_URL}/${lang}/glossary` },
    { name: g.term, url: `${SEO_SITE_URL}/${lang}/glossary/${g.slug}` },
  ]);
  const related = g.related.map(getTerm).filter((x): x is NonNullable<typeof x> => x != null);
  return (
    <main className="max-w-2xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <Link href={`/${lang}/glossary`} className="text-xs text-blue-400">← {t.glossary.backToIndex}</Link>
      <h1 className="text-3xl font-bold mt-2 mb-3">{g.term}</h1>
      <p className="text-lg text-zinc-200 leading-relaxed">{g.definition}</p>
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white mb-1">{t.glossary.howWeCalculate}</h2>
        <p className="text-zinc-400 leading-relaxed">{g.howCalculated}</p>
      </section>
      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-300 mb-1">{t.glossary.relatedTitle}</h2>
          <ul className="text-blue-400 text-sm space-y-1">
            {related.map((r) => (
              <li key={r.slug}><Link href={`/${lang}/glossary/${r.slug}`}>{r.term}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
