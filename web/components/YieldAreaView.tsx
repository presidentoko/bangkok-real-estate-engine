import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { districtDisplayName, getCity, provinceDisplayName } from "@/lib/cities";
import { findFloodDistrict } from "@/lib/floodDistricts";
import { fmtTHB } from "@/lib/fmt";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, type Lang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { getYieldAreaIndex } from "@/lib/queries/yieldAreas";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import { findYieldArea, type AreaStats, type YieldAreaIndex } from "@/lib/yieldAreas";

/* Shared by /yield/[city] and /yield/[city]/[district]. See lib/yieldAreas.ts
 * for why these pages exist and how an area qualifies. */

const pct = (n: number | null) => (n == null ? "—" : n.toFixed(1));

export function cityName(city: string, lang: Lang): string {
  return provinceDisplayName(city, lang);
}

/** Thai readers get the BMA khet name where we have one (Bangkok); everyone
 *  else gets the romanised name searchers type. */
export function districtName(district: string, lang: Lang): string {
  if (lang === "th") {
    const bma = findFloodDistrict(district);
    if (bma?.nameTh) return bma.nameTh;
  }
  return districtDisplayName(district);
}

/** "Sathorn, Bangkok" / "방콕 사톤" / "เขตสาทร กรุงเทพฯ" */
export function areaLabel(city: string, district: string | null, lang: Lang): string {
  const c = cityName(city, lang);
  if (!district) return c;
  const d = districtName(district, lang);
  if (lang === "ko") return `${c} ${d}`;
  if (lang === "th") return `${d} ${c}`;
  return `${d}, ${c}`;
}

function resolve(index: YieldAreaIndex, city: string, district?: string) {
  const area = findYieldArea(index, city, district);
  if (!area) notFound();
  return area;
}

function pathFor(city: string, district: string | null) {
  return district ? `/yield/${city}/${district}` : `/yield/${city}`;
}

export async function yieldAreaMetadata(
  rawLang: string,
  city: string,
  district?: string,
): Promise<Metadata> {
  const lang: Lang = isLang(rawLang) ? rawLang : "en";
  const index = await getYieldAreaIndex();
  const area = resolve(index, city, district);
  const s = (area.district ?? area.city).stats;
  const t = getDictionary(lang).yieldArea;
  const label = areaLabel(city, area.district?.district ?? null, lang);
  const title = t.title(label, pct(s.median), s.count, new Date().getFullYear());
  const description = t.desc(label, pct(s.median), s.count, pct(s.p25), pct(s.p75));
  const path = pathFor(city, area.district?.district ?? null);
  return {
    title,
    description,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}${path}`, languages: langAlternates(path) },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}${path}` }),
  };
}

export async function YieldAreaView({
  lang: rawLang,
  city,
  district,
}: {
  lang: string;
  city: string;
  district?: string;
}) {
  if (!isLang(rawLang)) notFound();
  const lang: Lang = rawLang;
  const [index, mortgage] = await Promise.all([getYieldAreaIndex(), getCurrentMortgageRate()]);
  const area = resolve(index, city, district);
  const dict = getDictionary(lang);
  const t = dict.yieldArea;

  const districtKey = area.district?.district ?? null;
  const s: AreaStats = (area.district ?? area.city).stats;
  const label = areaLabel(city, districtKey, lang);
  const cityLabel = cityName(city, lang);
  const parent = districtKey
    ? { label: cityLabel, stats: area.city.stats }
    : { label: t.thailand, stats: index.overall };
  const mrr = mortgage?.rate ?? null;
  const spread = mrr != null && s.median != null ? s.median - mrr : null;
  const path = pathFor(city, districtKey);

  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.nav.yields, href: `/${lang}/yields` },
    { name: cityLabel, href: `/${lang}/yield/${city}` },
    ...(districtKey ? [{ name: districtName(districtKey, lang), href: `/${lang}${path}` }] : []),
  ];

  const topList = s.top
    .slice(0, 3)
    .map((r) => `${r.name} (${pct(r.gross_yield_pct)}%)`)
    .join(", ");
  const faqItems = [
    { q: t.faq.q1(label), a: t.faq.a1(label, pct(s.median), s.count, pct(s.p25), pct(s.p75)) },
    {
      q: t.faq.q2(label),
      a: t.faq.a2(label, pct(s.median), mrr != null ? mrr.toFixed(2) : null, parent.label, pct(parent.stats.median)),
    },
    ...(topList ? [{ q: t.faq.q3(label), a: t.faq.a3(label, topList) }] : []),
    { q: t.faq.q4, a: t.faq.a4 },
  ];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.topTitle(label),
    itemListElement: s.top.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${r.slug}`,
    })),
  };

  const siblings = districtKey
    ? area.city.districts.filter((d) => d.district !== districtKey)
    : [];
  const otherCities = index.cities.filter((c) => c.city !== city);

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(itemList) }} />

      <header className="space-y-3">
        <Breadcrumbs items={crumbs} />
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.h1(label, pct(s.median))}</h1>
      </header>

      {/* The answer, first. */}
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-3">
        <p className="text-sm leading-relaxed text-zinc-200">
          {t.verdict(label, pct(s.median), s.count, pct(s.p25), pct(s.p75))}
        </p>
        {spread != null && mrr != null && (
          <p className="text-sm leading-relaxed text-zinc-300">
            {t.spread(`${spread >= 0 ? "+" : ""}${spread.toFixed(1)}`, mrr.toFixed(2), spread >= 0)}
          </p>
        )}
        <p className="text-xs text-zinc-400">{t.vsParent(parent.label, pct(parent.stats.median))}</p>
      </section>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label={t.statMedian} value={`${pct(s.median)}%`} />
        <Stat label={t.statRange} value={`${pct(s.p25)}–${pct(s.p75)}%`} />
        <Stat label={t.statCount} value={String(s.count)} />
        <Stat label={t.statSale} value={fmtTHB(s.medianSale)} />
        <Stat label={t.statRent} value={fmtTHB(s.medianRent)} />
      </dl>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t.bandsTitle(label)}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4">{t.colBand}</th>
                <th className="py-2 pr-4">{t.colBuildings}</th>
                <th className="py-2 pr-4">{t.colMedian}</th>
              </tr>
            </thead>
            <tbody>
              {s.bands.map((b) => (
                <tr key={b.key} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-200">{t.bands[b.key]}</td>
                  <td className="py-2 pr-4 text-zinc-400 tabular-nums">{b.count}</td>
                  <td className="py-2 pr-4 text-emerald-400 tabular-nums">
                    {b.median != null ? `${pct(b.median)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">{t.bandsNote}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t.topTitle(label)}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4">{t.colCondo}</th>
                <th className="py-2 pr-4">{t.colYield}</th>
                <th className="py-2 pr-4">{t.colSale}</th>
                <th className="py-2 pr-4">{t.colRent}</th>
              </tr>
            </thead>
            <tbody>
              {s.top.map((r) => (
                <tr key={r.id} className="border-b border-zinc-900">
                  <td className="py-2 pr-4">
                    <Link href={`/${lang}/condo/${r.slug}`} className="text-zinc-200 hover:text-emerald-400 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-emerald-400 tabular-nums">{pct(r.gross_yield_pct)}%</td>
                  <td className="py-2 pr-4 text-zinc-400 tabular-nums">{fmtTHB(r.avg_sale_price)}</td>
                  <td className="py-2 pr-4 text-zinc-400 tabular-nums">{fmtTHB(r.avg_monthly_rent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!districtKey && area.city.districts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t.districtsTitle(cityLabel)}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-4">{t.colDistrict}</th>
                  <th className="py-2 pr-4">{t.colBuildings}</th>
                  <th className="py-2 pr-4">{t.colMedian}</th>
                </tr>
              </thead>
              <tbody>
                {area.city.districts.map((d) => (
                  <tr key={d.district} className="border-b border-zinc-900">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/${lang}/yield/${city}/${d.district}`}
                        className="text-zinc-200 hover:text-emerald-400 hover:underline"
                      >
                        {districtName(d.district, lang)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-400 tabular-nums">{d.stats.count}</td>
                    <td className="py-2 pr-4 text-emerald-400 tabular-nums">{pct(d.stats.median)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        {siblings.length > 0 && (
          <Chips
            title={t.siblingsTitle(cityLabel)}
            items={siblings.map((d) => ({
              href: `/${lang}/yield/${city}/${d.district}`,
              label: districtName(d.district, lang),
              value: pct(d.stats.median),
            }))}
          />
        )}
        {otherCities.length > 0 && (
          <Chips
            title={t.citiesTitle}
            items={otherCities.map((c) => ({
              href: `/${lang}/yield/${c.city}`,
              label: cityName(c.city, lang),
              value: pct(c.stats.median),
            }))}
          />
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {districtKey && (
            <Link href={`/${lang}/district/${districtKey}`} className="text-emerald-400 hover:underline">
              {t.seeDistrict(districtName(districtKey, lang))} →
            </Link>
          )}
          {!districtKey && getCity(city) && (
            <Link href={`/${lang}/city/${getCity(city)!.slug}`} className="text-emerald-400 hover:underline">
              {t.seeCity(cityLabel)} →
            </Link>
          )}
          <Link href={`/${lang}/yields`} className="text-emerald-400 hover:underline">
            {t.seeRanking} →
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

function Chips({
  title,
  items,
}: {
  title: string;
  items: Array<{ href: string; label: string; value: string }>;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{title}</div>
      <ul className="flex flex-wrap gap-2">
        {items.map((x) => (
          <li key={x.href}>
            <Link
              href={x.href}
              className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              {x.label}
              <span className="text-zinc-500"> · {x.value}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
