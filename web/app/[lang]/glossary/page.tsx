// web/app/[lang]/glossary/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildDefinedTermSetJsonLd } from "@/lib/seo/definedTermJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { GLOSSARY } from "@/lib/glossary";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Glossary — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.glossary.title} | RealData`,
    description: t.glossary.lead,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}/glossary`, languages: langAlternates(`/glossary`) },
  };
}

export default async function GlossaryIndex({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const setJsonLd = buildDefinedTermSetJsonLd({
    name: t.glossary.title,
    url: `${SEO_SITE_URL}/${lang}/glossary`,
    terms: GLOSSARY.map((g) => ({ term: g.term, url: `${SEO_SITE_URL}/${lang}/glossary/${g.slug}` })),
  });
  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.glossary.breadcrumb, url: `${SEO_SITE_URL}/${lang}/glossary` },
  ]);
  return (
    <main className="max-w-3xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(setJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <h1 className="text-3xl font-bold mb-2">{t.glossary.title}</h1>
      <p className="text-zinc-400 mb-6">{t.glossary.lead}</p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {GLOSSARY.map((g) => (
          <li key={g.slug} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <Link href={`/${lang}/glossary/${g.slug}`} className="font-semibold text-blue-400">{g.term}</Link>
            <p className="text-zinc-400 text-sm mt-1">{g.definition}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
