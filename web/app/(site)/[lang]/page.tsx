import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingCard } from "@/components/BuildingCard";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import FaqSection from "@/components/FaqSection";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import {
  InventoryMapSvg,
  type KhetCount,
  type CondoPoint,
} from "@/components/InventoryMapSvg";
import { COMPARE_PAIRS } from "@/lib/comparePairs";
import { sideName } from "@/components/AreaVsView";
import { getYieldAreaIndex } from "@/lib/queries/yieldAreas";
import { getFeeAreaIndex } from "@/lib/queries/feeAreas";
import { CITIES, districtDisplayName, provinceDisplayName } from "@/lib/cities";
import { MIN_AREA_CONDOS } from "@/lib/yieldAreas";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import {
  fetchCondoMapPoints,
  fetchHomeFeatured,
  fetchSiteStats,
  type CondoSummary,
} from "@/lib/queries/condos";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";

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
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}` }),
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

  const [yieldIndex, feeIndex] = await Promise.all([
    getYieldAreaIndex().catch(() => null),
    getFeeAreaIndex().catch(() => null),
  ]);
  const yieldCities = (yieldIndex?.cities ?? []).slice(0, 6);
  const feeCities = (feeIndex?.cities ?? []).slice(0, 5);

  const [mapPoints, featured, stats] = await Promise.all([
    fetchCondoMapPoints(),
    fetchHomeFeatured(),
    // At build time there is no previous page to keep, so a failed stats
    // read renders dashes rather than failing the deployment; at runtime it
    // throws, and ISR keeps serving the last good page.
    fetchSiteStats().catch((e) => {
      if (process.env.NEXT_PHASE === "phase-production-build") return null;
      throw e;
    }),
  ]);

  // ---- Aggregations (from the lean map-point feed, not every full card)
  const counts = new Map<string, number>();
  const points: CondoPoint[] = [];
  for (const c of mapPoints) {
    if (c.region) counts.set(c.region, (counts.get(c.region) ?? 0) + 1);
    if (c.latitude != null && c.longitude != null) {
      points.push({
        // CondoMapPoint no longer carries the UUID (see its definition —
        // it was 430KB of a payload 4% from Next's cache ceiling). The slug
        // is unique and is what the marker links to anyway, so it serves as
        // both the React key and the href.
        id: c.slug,
        slug: c.slug,
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

  // "Typical Bangkok yield" FAQ answer, computed from the same index that
  // /yield/bangkok prints, so the two can never disagree. It used to be a
  // hand-written "median around 4.5-5%" while /yield/bangkok said 5.3%.
  // English only: the ko/th FAQs never carried this question.
  const bkk = yieldIndex?.cities.find((c) => c.city === "bangkok");
  const faqItems = [...t.home.faq];
  if (lang === "en" && bkk?.stats.median != null) {
    const s = bkk.stats;
    const ranked = bkk.districts.filter((d) => d.stats.median != null);
    const lo = ranked[ranked.length - 1];
    const hi = ranked[0];
    const f1 = (n: number | null) => (n == null ? "—" : n.toFixed(1));
    const spread =
      lo && hi && lo !== hi
        ? ` District medians run from ${f1(lo.stats.median)}% in ${districtDisplayName(lo.district)} to ${f1(hi.stats.median)}% in ${districtDisplayName(hi.district)} (districts with at least ${MIN_AREA_CONDOS} measured condos).`
        : "";
    const at = faqItems.findIndex((f) => f.q === "How often is the data refreshed?");
    faqItems.splice(at >= 0 ? at + 1 : faqItems.length, 0, {
      q: "What is the typical rental yield for condos in Bangkok?",
      a:
        `Across the ${s.count.toLocaleString("en-US")} Bangkok condos with enough sale and rent listings to measure, ` +
        `the median gross rental yield is ${f1(s.median)}%; the middle half sit between ${f1(s.p25)}% and ${f1(s.p75)}%.` +
        spread +
        " Net yield is typically 1.5–3 percentage points lower after CAM fees, vacancy, and management costs. " +
        "Figures are Bangkok only and update weekly; see the Bangkok yield page for the full breakdown.",
    });
  }

  const fmtStat = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());

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
              { n: fmtStat(stats?.buildings), l: t.home.statsLabels.buildings },
              { n: fmtStat(stats?.listings), l: t.home.statsLabels.listings },
              { n: fmtStat(stats?.chartPoints), l: t.home.statsLabels.chartPts },
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
              { n: fmtStat(stats?.totalCondos), l: "condo pages across 4 portals" },
              { n: fmtStat(stats?.withYield), l: "yield-measured condos" },
              { n: fmtStat(stats?.macroPoints), l: "BOT macro datapoints" },
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
          subtitle={t.home.featured.superValue.subtitle(stats?.superValue ?? 0, stats?.withBubble ?? 0)}
          condos={superValue}
          priority
        />
      )}

      {/* Lead capture — the home page had no conversion path at all before
          this; every other page type (condo, city, district) has one. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <LeadCaptureCTA lang={lang} />
      </section>

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
            {mapPoints.length.toLocaleString()} {t.home.inventoryStatsCondos} ·{" "}
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
          totalBuildings={points.length}
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

      {/* Area data — the yield, fee and comparison pages. They shipped in
          September reachable only from deep pages and the sitemap, and a
          month later had one impression between them: Google had not
          crawled them. Everything here is one click from the home page. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-zinc-900">
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {t.home.dataByAreaTitle}
          </h2>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">{t.home.dataByAreaLead}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {yieldCities.map((c) => (
            <Link
              key={`y-${c.city}`}
              href={`/${lang}/yield/${c.city}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {provinceDisplayName(c.city, lang)}
              <span className="text-zinc-500"> · {(c.stats.median ?? 0).toFixed(1)}%</span>
            </Link>
          ))}
          {feeCities.map((c) => (
            <Link
              key={`f-${c.city}`}
              href={`/${lang}/fees/${c.city}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {provinceDisplayName(c.city, lang)}
              <span className="text-zinc-500"> · ฿{Math.round(c.stats.median ?? 0).toLocaleString()}</span>
            </Link>
          ))}
          {COMPARE_PAIRS.slice(0, 6).map((p) => (
            <Link
              key={p.slug}
              href={`/${lang}/vs/${p.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {sideName(p, p.a, lang)} vs {sideName(p, p.b, lang)}
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <FaqSection items={faqItems} heading={t.home.faqTitle} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdString({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              inLanguage: lang,
              mainEntity: faqItems.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      </div>
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
  priority = false,
}: {
  lang: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  subtitle: string;
  condos: CondoSummary[];
  // Only the FIRST FeaturedRow on the page (super-value picks — the first
  // thing below the hero) should set this. It marks just the first grid row
  // eager so the actual LCP image isn't held back behind lazy-loading, while
  // every other row (and every other FeaturedRow instance) stays lazy.
  priority?: boolean;
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
        {condos.map((c, i) => (
          <BuildingCard
            key={c.id}
            condo={c}
            hrefPrefix={`/${lang}/condo/`}
            size="sm"
            priority={priority && i < 2}
          />
        ))}
      </div>
    </section>
  );
}
