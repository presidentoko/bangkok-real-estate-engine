// web/app/[lang]/near/[station]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BuildingCard } from "@/components/BuildingCard";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { getViableStations, getStationData } from "@/lib/queries/stations";

export const revalidate = 86400;

export async function generateStaticParams() {
  const stations = await getViableStations();
  return stations.flatMap((s) =>
    LANGS.map((lang) => ({ lang, station: s.slug })),
  );
}

function fill(tpl: string, station: string): string {
  return tpl.replace(/\{station\}/g, station);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; station: string }>;
}): Promise<Metadata> {
  const { lang, station } = await params;
  if (!isLang(lang)) return { title: "Stations — RealData" };
  const data = await getStationData(station);
  const t = getDictionary(lang);
  if (!data) return { title: "Stations — RealData" };
  const title = fill(t.near.metaSuffix, data.name);
  const desc = `${fill(t.near.summaryLead, data.name)} ${data.condos.length} condos${
    data.medianYieldPct != null ? `, median gross yield ${data.medianYieldPct.toFixed(1)}%` : ""
  }.`;
  return {
    title,
    description: desc,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/near/${station}`,
      languages: langAlternates(`/near/${station}`),
    },
    openGraph: { title, description: desc, url: `${SEO_SITE_URL}/${lang}/near/${station}`, type: "article" },
  };
}

export default async function StationPage({
  params,
}: {
  params: Promise<{ lang: string; station: string }>;
}) {
  const { lang, station } = await params;
  if (!isLang(lang)) notFound();
  const data = await getStationData(station);
  if (!data) notFound();
  const t = getDictionary(lang);

  const faq = [
    {
      q: `How many condos are near ${data.name} station?`,
      a: `RealData tracks ${data.condos.length} condos within 1 km of ${data.name}${
        data.medianPsm != null ? `, at a median of ฿${Math.round(data.medianPsm).toLocaleString()}/sqm` : ""
      }.`,
    },
    {
      q: `What is the rental yield near ${data.name}?`,
      a:
        data.medianYieldPct != null
          ? `The median gross rental yield for condos near ${data.name} is ${data.medianYieldPct.toFixed(1)}%.`
          : `Yield data near ${data.name} is still being compiled.`,
    },
    {
      q: `Is the area around ${data.name} prone to flooding?`,
      a:
        data.avgFloodLevel != null
          ? `Buildings near ${data.name} carry an average flood-risk level of ${data.avgFloodLevel} on our L1–L5 scale.`
          : `Flood-risk data near ${data.name} is still being compiled.`,
    },
  ];

  const breadcrumbs = buildBreadcrumbsJsonLd([
    { name: "RealData", url: `${SEO_SITE_URL}/${lang}` },
    { name: t.near.breadcrumb, url: `${SEO_SITE_URL}/${lang}/inventory` },
    { name: data.name, url: `${SEO_SITE_URL}/${lang}/near/${station}` },
  ]);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd(faq)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {data.condos.length} {t.near.titleSuffix} {data.name}
        </h1>
        <p className="text-zinc-400 text-sm">
          {fill(t.near.summaryLead, data.name)} {data.condos.length} {t.near.statCondos}
          {data.medianPsm != null && ` · ${Math.round(data.medianPsm).toLocaleString()} ${t.near.statMedianPsm}`}
          {data.medianYieldPct != null && ` · ${data.medianYieldPct.toFixed(1)}% ${t.near.statMedianYield}`}
          {data.avgFloodLevel != null && ` · L${data.avgFloodLevel} ${t.near.statAvgFlood}`}
        </p>
      </header>

      <h2 className="text-xl font-semibold mb-3">{fill(t.near.listTitle, data.name)}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {data.condos.map((c) => (
          <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} size="sm" />
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">{t.near.faqTitle}</h2>
        <dl className="space-y-3">
          {faq.map((f) => (
            <div key={f.q} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <dt className="font-semibold text-zinc-200">{f.q}</dt>
              <dd className="text-zinc-400 text-sm mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 text-sm">
        <div className="text-zinc-300 font-semibold mb-1">{t.near.relatedHubs}</div>
        <ul className="text-blue-400 space-y-1">
          <li><Link href={`/${lang}/guide/investment`}>Bangkok condo investment guide</Link></li>
          <li><Link href={`/${lang}/guide/foreign-ownership`}>Can foreigners buy a condo?</Link></li>
          <li><Link href={`/${lang}/glossary/gross-yield`}>What is gross yield?</Link></li>
        </ul>
      </section>
    </main>
  );
}
