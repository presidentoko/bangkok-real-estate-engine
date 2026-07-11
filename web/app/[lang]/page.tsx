import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingCard } from "@/components/BuildingCard";
import {
  InventoryMapSvg,
  type KhetCount,
  type CondoPoint,
} from "@/components/InventoryMapSvg";
import { CITIES } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import {
  fetchCondoMapPoints,
  fetchHomeFeatured,
  fetchSiteStats,
  type CondoSummary,
} from "@/lib/queries/condos";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

// Stale while revalidate; data only changes when scrapers run (weekly).
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getDictionary(lang);
  const title = lang === "en"
    ? "Bangkok Condo Data — Yields, Prices & Flood Risk | RealData"
    : `${t.brand.name} — ${t.home.heroTitle1} ${t.home.heroTitle2Highlight}${t.home.heroTitle3}`;
  const description = lang === "en"
    ? "Independent data on 1,800+ Thai condos across 9 cities — rental yields vs Bank of Thailand mortgage rate, district flood risk, foreign-quota inventory, cross-portal price comparison. Bangkok, Phuket, Chiang Mai and 6 more."
    : t.home.heroLead;
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}`,
      languages: langAlternates(""),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}`,
      type: "website",
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  const [mapPoints, featured, stats] = await Promise.all([
    fetchCondoMapPoints(),
    fetchHomeFeatured(),
    fetchSiteStats(),
  ]);

  // ---- Aggregations (from the lean map-point feed, not every full card)
  const counts = new Map<string, number>();
  const points: CondoPoint[] = [];
  for (const c of mapPoints) {
    if (c.region) counts.set(c.region, (counts.get(c.region) ?? 0) + 1);
    if (c.latitude != null && c.longitude != null) {
      points.push({
        id: c.id,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
      });
    }
  }
  const khetCounts: KhetCount[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Cap dots actually rendered in the SSR'd SVG — the map ships one
  // <Link><circle> per point, and at ~12k condos that alone was a large
  // chunk of the ~1.5MB homepage HTML (confirmed 2026-07-10 audit). Evenly
  // stride-sample instead of truncating to the first N so the map still
  // reads as geographically representative rather than clustering wherever
  // the DB happens to return rows first.
  const DOT_CAP = 400;
  const mapDots =
    points.length > DOT_CAP
      ? points.filter((_, i) => i % Math.ceil(points.length / DOT_CAP) === 0)
      : points;

  // Featured picks (selected DB-side in fetchHomeFeatured)
  const { superValue, overpriced, safest } = featured;

  return (
    <div>
      {/* Hero */}
      <section className="relative border-b border-zinc-900 overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.12),transparent_60%)]" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-pink-400 text-xs font-bold uppercase tracking-widest mb-3">
            {t.home.heroPretitle}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl">
            {t.home.heroTitle1}{" "}
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-200 bg-clip-text text-transparent">
              {t.home.heroTitle2Highlight}
            </span>
            {t.home.heroTitle3}
          </h1>
          <p className="text-zinc-400 mt-5 max-w-2xl text-base sm:text-lg leading-relaxed">
            {t.home.heroLead}
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link
              href={`/${lang}/ask`}
              className="bg-emerald-500 text-zinc-950 font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20"
            >
              {t.home.ctaFlood}
            </Link>
            <Link
              href={`/${lang}/yields`}
              className="bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-400 transition shadow-lg shadow-blue-500/20"
            >
              {t.home.ctaInventory}
            </Link>
            <Link
              href={`/${lang}/flood`}
              className="bg-zinc-800 text-zinc-100 font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition"
            >
              Flood map →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12 max-w-3xl">
            {[
              { n: stats.buildings.toLocaleString(), l: t.home.statsLabels.buildings },
              { n: stats.listings.toLocaleString(), l: t.home.statsLabels.listings },
              { n: stats.chartPoints.toLocaleString(), l: t.home.statsLabels.chartPts },
              // Bangkok flood map = all 50 khet covered. Stat is hardcoded
              // because the flood layer is a single curated dataset, not a
              // scraped count. Label makes the scope explicit so it doesn't
              // get confused with the all-9-cities sub-areas total on /data.
              { n: "50 / 50", l: "Bangkok khet mapped (flood)" },
            ].map((s) => (
              <div
                key={s.l}
                className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 backdrop-blur"
              >
                <div className="text-2xl sm:text-3xl font-black tabular-nums bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
                  {s.n}
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Live-data strip: cross-portal coverage + macro depth */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 max-w-3xl">
            {[
              { n: stats.totalCondos.toLocaleString(), l: "condos across 4 portals" },
              { n: stats.totalListings.toLocaleString(), l: "active listings" },
              { n: stats.withYield.toLocaleString(), l: "yield-measured condos" },
              { n: stats.macroPoints.toLocaleString(), l: "BOT macro datapoints" },
            ].map((s) => (
              <div
                key={s.l}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 backdrop-blur"
              >
                <div className="text-xl sm:text-2xl font-black tabular-nums bg-gradient-to-b from-emerald-200 to-emerald-500 bg-clip-text text-transparent">
                  {s.n}
                </div>
                <div className="text-[11px] sm:text-xs text-emerald-300/60 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Super Value picks */}
      {superValue.length > 0 && (
        <FeaturedRow
          lang={lang}
          eyebrow={t.home.featured.superValue.eyebrow}
          eyebrowColor="text-emerald-400"
          title={t.home.featured.superValue.title}
          subtitle={t.home.featured.superValue.subtitle(stats.superValue, stats.withBubble)}
          condos={superValue}
        />
      )}

      {/* Bubble TOP */}
      <FeaturedRow
        lang={lang}
        eyebrow={t.home.featured.bubbleWatch.eyebrow}
        eyebrowColor="text-rose-400"
        title={t.home.featured.bubbleWatch.title}
        subtitle={t.home.featured.bubbleWatch.subtitle}
        condos={overpriced}
      />

      {/* Safest from flood */}
      {safest.length > 0 && (
        <FeaturedRow
          lang={lang}
          eyebrow={t.home.featured.dryHighGround.eyebrow}
          eyebrowColor="text-sky-400"
          title={t.home.featured.dryHighGround.title}
          subtitle={t.home.featured.dryHighGround.subtitle}
          condos={safest}
        />
      )}

      {/* Feature cards (functional nav) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.home.featuresHeader}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {t.home.features.map((f, i) => {
            const accents = [
              "from-rose-500/20 to-rose-500/5",
              "from-amber-500/20 to-amber-500/5",
              "from-pink-500/20 to-pink-500/5",
              "from-sky-500/20 to-sky-500/5",
            ];
            return (
              <Link
                key={f.href}
                href={`/${lang}${f.href}`}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition overflow-hidden"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${accents[i] ?? accents[0]} opacity-50 group-hover:opacity-100 transition`}
                />
                <div className="relative">
                  <div className="text-3xl mb-3">{f.emoji}</div>
                  <div className="font-bold text-lg">{f.title}</div>
                  <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{f.desc}</p>
                  <div className="mt-3 inline-block text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                    {f.badge}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Inventory map */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-semibold">{t.home.inventoryTitle}</h2>
          <span className="text-zinc-500 text-sm">
            {stats.buildings.toLocaleString()} {t.home.inventoryStatsCondos} ·{" "}
            {khetCounts.length} {t.home.inventoryStatsDistricts} ·{" "}
            <span className="text-amber-400">
              {points.length.toLocaleString()} {t.home.inventoryGeoSuffix}
            </span>
          </span>
          <Link
            href={`/${lang}/inventory`}
            className="text-zinc-300 hover:text-white text-sm underline underline-offset-4 ml-auto"
          >
            {t.home.inventoryFullList}
          </Link>
        </div>
        <InventoryMapSvg
          khetCounts={khetCounts}
          points={mapDots}
          totalBuildings={stats.buildings}
          condoLinkPrefix={`/${lang}/condo/`}
        />
        <p className="text-xs text-zinc-500 mt-2">{t.home.inventoryHelp}</p>
      </section>

      {/* Curated yield slices — entry points to /best/[city]/[slug] */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-zinc-900">
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Curated yield slices
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Hand-curated cuts — by city and budget — ranked against the current Thai mortgage rate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            { city: "bangkok",    slug: "top-yield",            label: "Top yield · Bangkok" },
            { city: "bangkok",    slug: "under-5m-top-yield",   label: "Best yield under ฿5M · Bangkok" },
            { city: "bangkok",    slug: "under-10m",            label: "Bangkok under ฿10M" },
            { city: "phuket",     slug: "top-yield",            label: "Top yield · Phuket" },
            { city: "phuket",     slug: "under-10m-top-yield",  label: "Best yield under ฿10M · Phuket" },
            { city: "chiang-mai", slug: "under-5m",             label: "Chiang Mai under ฿5M" },
            { city: "pattaya",    slug: "top-yield",            label: "Top yield · Pattaya" },
            { city: "hua-hin",    slug: "under-10m",            label: "Hua Hin under ฿10M" },
          ].map((s) => (
            <Link
              key={`${s.city}-${s.slug}`}
              href={`/${lang}/best/${s.city}/${s.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Other cities */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-zinc-900">
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {t.home.citiesHeader}
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">{t.home.citiesLead}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/city/${c.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition group"
            >
              <div className="font-bold text-zinc-100 group-hover:text-blue-300 transition">
                {c.name[lang]}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1.5 leading-snug line-clamp-3">
                {c.tagline[lang]}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.home.faqTitle}
        </h2>
        <div className="space-y-3">
          {t.home.faq.map((f, i) => (
            <details
              key={i}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 [&_summary]:cursor-pointer"
            >
              <summary className="font-semibold list-none flex items-baseline justify-between gap-3">
                <span>{f.q}</span>
                <span className="text-zinc-500 group-open:rotate-180 transition shrink-0">▾</span>
              </summary>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              inLanguage: lang,
              mainEntity: t.home.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      </section>
    </div>
  );
}

function FeaturedRow({
  lang,
  eyebrow,
  eyebrowColor,
  title,
  subtitle,
  condos,
}: {
  lang: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  subtitle: string;
  condos: CondoSummary[];
}) {
  if (condos.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-4">
        <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${eyebrowColor}`}>
          {eyebrow}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h2>
        <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {condos.map((c) => (
          <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} size="sm" />
        ))}
      </div>
    </section>
  );
}
