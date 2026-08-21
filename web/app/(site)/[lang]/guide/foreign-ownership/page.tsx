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

      <article className="space-y-6 text-zinc-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white">The 49% rule, in plain terms</h2>
          <p>Thailand’s Condominium Act lets non-Thais collectively own up to <strong>49% of the total saleable floor area</strong> of a condominium building. If a building still has room under that quota, a foreigner can buy a unit <Link className="text-blue-400" href={`/${lang}/glossary/freehold`}>freehold</Link> — outright, in their own name, registered at the Land Department. Once a building hits 49%, remaining units can only be sold to foreigners on a <Link className="text-blue-400" href={`/${lang}/glossary/leasehold`}>leasehold</Link> basis.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Land and houses</h2>
          <p>Foreigners generally <strong>cannot own land</strong> in Thailand. A villa or landed house is usually structured as a registered lease (maximum 30 years per term) or through a Thai company — the latter carries real legal exposure and needs qualified advice. For most overseas buyers, a condo is the only clean route to direct freehold ownership.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Moving the money (FET)</h2>
          <p>To register foreign freehold, the purchase funds must arrive in Thailand <strong>in foreign currency</strong> and be converted to baht by the receiving bank, which issues a <strong>Foreign Exchange Transaction (FET) certificate</strong>. The Land Department requires this document at transfer — so never bring the money in as baht.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Taxes and transfer costs</h2>
          <ul className="list-disc pl-5">
            <li>Transfer fee: <strong>2%</strong> of the appraised value.</li>
            <li>Specific Business Tax: <strong>3.3%</strong> if the seller owned under 5 years; otherwise <strong>0.5%</strong> stamp duty.</li>
            <li>Withholding tax: progressive (individual) or 1% (company).</li>
            <li>All of the above are negotiable between buyer and seller.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-white">Buying process, step by step</h2>
          <ol className="list-decimal pl-5">
            <li>Reserve the unit and sign a reservation agreement.</li>
            <li>Confirm the building’s remaining <Link className="text-blue-400" href={`/${lang}/glossary/foreign-quota`}>foreign quota</Link> in writing.</li>
            <li>Due diligence: title deed, encumbrances, juristic-person debts.</li>
            <li>Remit funds from abroad and collect the FET certificate.</li>
            <li>Transfer ownership at the Land Department and pay fees.</li>
          </ol>
        </section>
      </article>

      <FaqSection items={t.pageFaq.guideForeign} heading={t.home.faqTitle} className="mt-10" />

      <section className="mt-8 border-t border-zinc-800 pt-4 text-sm">
        <p className="text-zinc-500">This guide is general information, not legal advice. Next: <Link className="text-blue-400" href={`/${lang}/guide/investment`}>the Bangkok condo investment guide</Link> with live yield data.</p>
      </section>
    </main>
  );
}
