// web/app/[lang]/guide/foreign-ownership/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd, type FaqItem } from "@/lib/seo/faqJsonLd";
import FaqSection from "@/components/FaqSection";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const revalidate = 86400;


export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Foreign ownership — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.guide.foreign.title} | RealData`,
    description: t.guide.foreign.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/guide/foreign-ownership`,
      languages: langAlternates(`/guide/foreign-ownership`),
    },
    openGraph: ogFor(lang, { title: t.guide.foreign.title, description: t.guide.foreign.lead, url: `${SEO_SITE_URL}/${lang}/guide/foreign-ownership`, type: "article" }),
  };
}

export default async function ForeignOwnershipPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const f = t.guide.foreign;
  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: t.guide.breadcrumb, href: `/${lang}/guide/investment` },
    { name: t.guide.foreign.title, href: `/${lang}/guide/foreign-ownership` },
  ];
  const breadcrumbs = buildBreadcrumbsJsonLd(
    crumbs.map((c) => ({ name: c.name, url: `${SEO_SITE_URL}${c.href}` }))
  );
  return (
    <main className="max-w-3xl mx-auto p-6 prose-invert">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(buildFaqJsonLd(t.pageFaq.guideForeign)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbs) }} />
      <Breadcrumbs items={crumbs} />
      <h1 className="text-3xl font-bold mb-2 mt-2">{t.guide.foreign.title}</h1>
      <p className="text-zinc-400 mb-6">{t.guide.foreign.lead}</p>

      {/* Body copy lives in the dictionaries. It used to be hardcoded English
          JSX, so /ko and /th shipped an English article under a translated
          title. */}
      <article className="space-y-6 text-zinc-300 leading-relaxed">
        {f.sections.map((sec) => (
          <section key={sec.h}>
            <h2 className="text-xl font-semibold text-white">{sec.h}</h2>
            <p>{sec.p}</p>
          </section>
        ))}
        <section>
          <h2 className="text-xl font-semibold text-white">{f.taxTitle}</h2>
          <ul className="list-disc pl-5">
            {f.taxes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">{f.stepsTitle}</h2>
          <ol className="list-decimal pl-5">
            {f.steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <Link className="inline-block mt-3 text-blue-400 hover:underline" href={`/${lang}/guide/foreign-quota`}>
            {f.quotaCta} →
          </Link>
        </section>
        <p className="text-sm">
          <Link className="text-blue-400" href={`/${lang}/glossary/freehold`}>Freehold</Link>
          {" · "}
          <Link className="text-blue-400" href={`/${lang}/glossary/leasehold`}>Leasehold</Link>
          {" · "}
          <Link className="text-blue-400" href={`/${lang}/glossary/foreign-quota`}>Foreign quota</Link>
        </p>
      </article>

      <FaqSection items={t.pageFaq.guideForeign} heading={t.home.faqTitle} className="mt-10" />

      <section className="mt-8 border-t border-zinc-800 pt-4 text-sm">
        <p className="text-zinc-500">
          {f.disclaimer}{" "}
          <Link className="text-blue-400" href={`/${lang}/guide/investment`}>{f.next}</Link>
        </p>
      </section>
    </main>
  );
}
