import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { CONDO_STATIC_BUILD } from "@/lib/buildMode";
import { districtDisplayName, provinceDisplayName } from "@/lib/cities";
import { findFloodDistrict } from "@/lib/floodDistricts";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS, type Lang } from "@/lib/i18n";
import { findFeeCity, getFeeAreaIndex } from "@/lib/queries/feeAreas";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

/* Common-area fees per area. "ค่าส่วนกลาง เท่าไร" is asked constantly and
 * answered only per listing; we hold a monthly fee for 2,896 buildings.
 * See lib/queries/feeAreas.ts for the eligibility bar and lib/camFee.ts for
 * why a reading outside ฿200-60,000 is not a fee. */

export const revalidate = 604800;

const n0 = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));

function districtName(slug: string, lang: Lang): string {
  if (lang === "th") {
    const bma = findFloodDistrict(slug);
    if (bma?.nameTh) return bma.nameTh;
  }
  return districtDisplayName(slug);
}

export async function generateStaticParams() {
  if (CONDO_STATIC_BUILD) return [];
  const index = await getFeeAreaIndex();
  return index.cities.flatMap((c) => LANGS.map((lang) => ({ lang, city: c.city })));
}

type Params = { params: Promise<{ lang: string; city: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang: rawLang, city } = await params;
  const lang: Lang = isLang(rawLang) ? rawLang : "en";
  const index = await getFeeAreaIndex();
  const area = findFeeCity(index, city);
  if (!area) notFound();
  const t = getDictionary(lang).feeArea;
  const label = provinceDisplayName(city, lang);
  const path = `/fees/${city}`;
  const title = t.metaTitle(label, n0(area.stats.median), new Date().getFullYear());
  const description = t.desc(label, n0(area.stats.median), area.stats.count);
  return {
    title,
    description,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}${path}`, languages: langAlternates(path) },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}${path}` }),
  };
}

export default async function FeesCityPage({ params }: Params) {
  const { lang: rawLang, city } = await params;
  if (!isLang(rawLang)) notFound();
  const lang: Lang = rawLang;
  const index = await getFeeAreaIndex();
  const area = findFeeCity(index, city);
  if (!area) notFound();

  const dict = getDictionary(lang);
  const t = dict.feeArea;
  const label = provinceDisplayName(city, lang);
  const s = area.stats;
  const path = `/fees/${city}`;

  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.guide.breadcrumb, href: `/${lang}/guide/buying-costs` },
    { name: label, href: `/${lang}${path}` },
  ];

  const faqItems = [
    { q: t.faq.q1(label), a: t.faq.a1(label, n0(s.median), s.count, n0(s.p25), n0(s.p75)) },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(buildFaqJsonLd(faqItems)) }}
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
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.h1(label, n0(s.median))}</h1>
      </header>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-3">
        <p className="text-sm leading-relaxed text-zinc-200">
          {t.verdict(label, n0(s.median), s.count, n0(s.p25), n0(s.p75))}
        </p>
        {s.medianSink != null && (
          <p className="text-sm leading-relaxed text-zinc-300">{t.sinkLine(n0(s.medianSink))}</p>
        )}
        <p className="text-xs text-zinc-400">{t.vsThailand(n0(index.overall.median))}</p>
      </section>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={t.statMedian} value={`฿${n0(s.median)}`} />
        <Stat label={t.statRange} value={`฿${n0(s.p25)}–฿${n0(s.p75)}`} />
        <Stat label={t.statCount} value={String(s.count)} />
        <Stat label={t.statSink} value={s.medianSink != null ? `฿${n0(s.medianSink)}` : "—"} />
      </dl>

      <p className="text-sm text-zinc-400 leading-relaxed">{t.unitNote}</p>

      {area.districts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.districtsTitle(label)}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-4">{t.colDistrict}</th>
                  <th className="py-2 pr-4">{t.colBuildings}</th>
                  <th className="py-2 pr-4">{t.colMedian}</th>
                  <th className="py-2 pr-4">{t.colRange}</th>
                </tr>
              </thead>
              <tbody>
                {area.districts.map((d) => (
                  <tr key={d.district} className="border-b border-zinc-900">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/${lang}/district/${d.district}`}
                        className="text-zinc-200 hover:text-emerald-400 hover:underline"
                      >
                        {districtName(d.district, lang)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400 tabular-nums">{d.stats.count}</td>
                    <td className="py-2 pr-4 text-emerald-400 tabular-nums">฿{n0(d.stats.median)}</td>
                    <td className="py-2 pr-4 text-zinc-500 tabular-nums">
                      ฿{n0(d.stats.p25)}–฿{n0(d.stats.p75)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.citiesTitle}</div>
          <ul className="flex flex-wrap gap-2">
            {index.cities
              .filter((c) => c.city !== city)
              .map((c) => (
                <li key={c.city}>
                  <Link
                    href={`/${lang}/fees/${c.city}`}
                    className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
                  >
                    {provinceDisplayName(c.city, lang)}
                    <span className="text-zinc-500"> · ฿{n0(c.stats.median)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href={`/${lang}/guide/buying-costs`} className="text-emerald-400 hover:underline">
            {t.seeCosts} →
          </Link>
          <Link href={`/${lang}/yield/${city}`} className="text-emerald-400 hover:underline">
            {t.seeYield(label)} →
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-200">{t.methodTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.methodBody}</p>
      </section>

      <FaqSection items={faqItems} heading={t.faqTitle(label)} />

      <LeadCaptureCTA lang={lang} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="text-lg font-bold text-zinc-100 tabular-nums">{value}</dd>
    </div>
  );
}
