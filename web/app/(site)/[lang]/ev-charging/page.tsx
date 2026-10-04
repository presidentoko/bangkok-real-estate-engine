import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { provinceDisplayName } from "@/lib/cities";
import { fmtTHB } from "@/lib/fmt";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getEvChargingCondos } from "@/lib/queries/evCharging";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

/* One page, not a directory. Only 31 of the 1,563 buildings whose facilities
 * we have read confirm a charger, so "EV condos in <area>" pages would be
 * empty — see lib/queries/evCharging.ts. */

export const revalidate = 604800;

const PATH = "/ev-charging";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "EV charging — RealData" };
  const t = getDictionary(lang).evCharging;
  const { condos } = await getEvChargingCondos();
  const title = t.metaTitle(condos.length, new Date().getFullYear());
  const description = t.desc(condos.length);
  return {
    title,
    description,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}${PATH}`, languages: langAlternates(PATH) },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}${PATH}` }),
  };
}

export default async function EvChargingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.evCharging;
  const { condos, checked } = await getEvChargingCondos();

  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.nav.inventory, href: `/${lang}/inventory` },
    { name: t.eyebrow, href: `/${lang}${PATH}` },
  ];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.h1(condos.length),
    itemListElement: condos.slice(0, 50).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${c.slug}`,
    })),
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(itemList) }} />

      <header className="space-y-3">
        <Breadcrumbs items={crumbs} />
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.h1(condos.length)}</h1>
      </header>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-zinc-200">{t.intro(condos.length, checked)}</p>
      </section>

      {condos.length === 0 ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t.noneTitle}</h2>
          <p className="text-sm text-zinc-400">{t.noneBody}</p>
        </section>
      ) : (
        <section className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4">{t.colBuilding}</th>
                <th className="py-2 pr-4">{t.colCity}</th>
                <th className="py-2 pr-4">{t.colSale}</th>
              </tr>
            </thead>
            <tbody>
              {condos.map((c) => (
                <tr key={c.slug} className="border-b border-zinc-900">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/${lang}/condo/${c.slug}`}
                      className="text-zinc-200 hover:text-emerald-400 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-zinc-400">{provinceDisplayName(c.city, lang)}</td>
                  <td className="py-2 pr-4 text-zinc-400 tabular-nums">{fmtTHB(c.sale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-200">{t.methodTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.methodBody}</p>
      </section>

      <FaqSection items={t.faq} heading={t.faqTitle} />

      <section className="border-t border-zinc-800 pt-4 text-sm">
        <Link href={`/${lang}/fees/bangkok`} className="text-emerald-400 hover:underline">
          {t.seeFees} →
        </Link>
      </section>
    </main>
  );
}
