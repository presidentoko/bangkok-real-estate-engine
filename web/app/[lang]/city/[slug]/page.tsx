import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { BuildingCard } from "@/components/BuildingCard";
import { CityMapSvg, type CityPoint } from "@/components/CityMapSvg";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { LinkShareButtons } from "@/components/LinkShareButtons";
import { TravelAffiliateCard } from "@/components/TravelAffiliateCard";
import { CITIES, cityProvinceSlugs, getCity, type City, type CitySlug } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, type Lang } from "@/lib/i18n";
import { type CondoSummary, type PropertyType } from "@/lib/queries/condos";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

export const revalidate = 86400;

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

const SELECT =
  "id, slug, name, url, latitude, longitude, hero_image_url, total_units, " +
  "available_units_count, market_sale_median, market_rent_median, " +
  "market_summary_currency, property_type, province, source, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

type Joined = {
  id: string;
  slug?: string | null;
  name: string;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  hero_image_url: string | null;
  total_units: number | null;
  available_units_count: number | null;
  market_sale_median: number | null;
  market_rent_median: number | null;
  market_summary_currency: string | null;
  property_type?: string | null;
  province?: string | null;
  source?: string | null;
  regions: { name: string } | { name: string }[] | null;
  value_scores: { bubble_index: number | null; is_super_value: boolean | null } | null
    | { bubble_index: number | null; is_super_value: boolean | null }[];
  risk_factors: { flood_risk_level: number | null } | null
    | { flood_risk_level: number | null }[];
};

function flatten(r: Joined): CondoSummary {
  const regions = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  const vs = Array.isArray(r.value_scores) ? r.value_scores[0] : r.value_scores;
  const rf = Array.isArray(r.risk_factors) ? r.risk_factors[0] : r.risk_factors;
  const pt = (r.property_type ?? "condo") as PropertyType;
  return {
    id: r.id,
    slug: r.slug ?? null,
    name: r.name,
    url: r.url,
    latitude: r.latitude,
    longitude: r.longitude,
    region: regions?.name ?? null,
    province: r.province ?? "bangkok",
    hero_image_url: r.hero_image_url,
    bubble_index: vs?.bubble_index ?? null,
    is_super_value: vs?.is_super_value ?? null,
    flood_risk_level: rf?.flood_risk_level ?? null,
    total_units: r.total_units,
    available_units_count: r.available_units_count,
    market_sale_median: r.market_sale_median,
    market_rent_median: r.market_rent_median,
    market_summary_currency: r.market_summary_currency,
    property_type: pt,
    source: r.source ?? "hipflat",
  };
}

const _fetchCityCondos = async (province: CitySlug): Promise<CondoSummary[]> => {
  const supabase = getServerSupabase();
  const out: CondoSummary[] = [];
  const PAGE = 1000;
  let offset = 0;
  // Accept both compact and kebab province values for the same UI city.
  const provinces = cityProvinceSlugs(province);
  while (true) {
    // City pages query the base table directly, so an unpublished city can
    // still be previewed at /[lang]/city/{slug} before we flip published=true.
    const { data, error } = await supabase
      .from("condos")
      .select(SELECT)
      .eq("source", "hipflat")
      .in("province", provinces)
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`city condo fetch failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Joined[];
    out.push(...rows.map(flatten));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
};

// Was an uncached plain function — every 86400s ISR regen re-pulled the
// whole city (Bangkok ~6k rows) with no memoisation between requests inside
// that window. Cached to match the page's own revalidate.
const fetchCityCondos = unstable_cache(
  _fetchCityCondos,
  ["city:condos"],
  { revalidate: 86400, tags: ["condos"] }
);

// Every published condo has a detail page regardless of whether it's
// rendered here, so cap what actually gets SSR'd into the HTML — unlike
// home's dot map, this is plain uncapped BuildingCard markup (image + text
// per card), and Bangkok alone runs ~6k condos with no limit before this.
// Stride-sample instead of truncating so the on-page sample still reads as
// geographically/score representative.
const GRID_CAP = 400;
const MAP_DOT_CAP = 600;
function sample<T>(arr: T[], cap: number): T[] {
  return arr.length > cap
    ? arr.filter((_, i) => i % Math.ceil(arr.length / cap) === 0)
    : arr;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const city = getCity(slug);
  const useLang: Lang = isLang(lang) ? lang : "en";
  if (!city) return { title: "City — RealData" };
  const name = city.name[useLang];
  const tagline = city.tagline[useLang];
  return {
    title: `${name} Condo Report — Bubble Index, prices, foreign-investor metrics | RealData`,
    description: tagline,
    alternates: {
      canonical: `${SEO_SITE_URL}/${useLang}/city/${slug}`,
      languages: langAlternates(`/city/${slug}`),
    },
    openGraph: {
      title: `${name} — Independent condo data report`,
      description: tagline,
      url: `${SEO_SITE_URL}/${useLang}/city/${slug}`,
      type: "website",
      locale: useLang,
    },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  if (!isLang(lang)) notFound();
  const city = getCity(slug);
  if (!city) notFound();

  const condos = await fetchCityCondos(city.slug);

  // Stats roll-up.
  const total = condos.length;
  const geoLocated = condos.filter((c) => c.latitude != null).length;
  const withBubble = condos.filter((c) => c.bubble_index != null).length;
  const superValue = condos.filter((c) => c.is_super_value).length;
  const districts = new Set(
    condos.map((c) => c.region).filter((x): x is string => !!x)
  );

  // Highlights.
  const superValuePicks = condos
    .filter((c) => c.is_super_value && c.hero_image_url)
    .slice(0, 6);
  const overpriced = [...condos]
    .filter((c) => c.bubble_index != null && c.hero_image_url)
    .sort((a, b) => (b.bubble_index ?? 0) - (a.bubble_index ?? 0))
    .slice(0, 6);

  const points: CityPoint[] = condos
    .filter((c) => c.latitude != null && c.longitude != null)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      lat: c.latitude as number,
      lng: c.longitude as number,
      bubbleIndex: c.bubble_index,
      url: c.url,
    }));
  const mapDots = sample(points, MAP_DOT_CAP);
  const gridCondos = sample(condos, GRID_CAP);

  const cityName = city.name[lang];
  const tagline = city.tagline[lang];
  const audience = city.audience[lang];
  const t = getDictionary(lang).cityPage;

  // ---- Structured data
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: cityName,
    description: tagline,
    address: {
      "@type": "PostalAddress",
      addressLocality: city.name.en,
      addressCountry: "TH",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: city.center[1],
      longitude: city.center[0],
    },
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Condo buildings in ${city.name.en}`,
    numberOfItems: total,
    itemListElement: condos.slice(0, 50).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SEO_SITE_URL}/${lang}/condo/${c.slug ?? c.id}`,
      name: c.name,
    })),
  };

  const breadcrumbsJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "RealData", item: `${SEO_SITE_URL}/${lang}` },
      { "@type": "ListItem", position: 2, name: cityName, item: `${SEO_SITE_URL}/${lang}/city/${slug}` },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbsJsonLd) }}
      />

      {/* Hero */}
      <section className="relative border-b border-zinc-900 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.12),transparent_60%)]" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <Link
            href={`/${lang}`}
            className="text-zinc-500 hover:text-zinc-300 text-sm inline-block mb-3"
          >
            ← RealData
          </Link>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-200 bg-clip-text text-transparent">
              {cityName}
            </span>
            <span className="text-zinc-400 font-bold ml-3 text-2xl sm:text-3xl">
              {t.headerSuffix}
            </span>
          </h1>
          <p className="text-zinc-400 mt-4 max-w-3xl text-base sm:text-lg leading-relaxed">
            {tagline}
          </p>
          <p className="text-zinc-500 mt-2 text-sm italic">{audience}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-2xl">
            {[
              { n: total.toLocaleString(), l: t.statBuildings },
              { n: districts.size.toLocaleString(), l: t.statSubAreas },
              { n: geoLocated.toLocaleString(), l: t.statGeo },
              { n: withBubble.toLocaleString(), l: t.statWithBubble },
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

          <div className="max-w-xs mt-6">
            <LinkShareButtons
              url={`${SEO_SITE_URL}/${lang}/city/${slug}`}
              title={`${cityName} ${t.headerSuffix} — RealData`}
            />
          </div>
        </div>
      </section>

      {/* Map */}
      {points.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="text-xl font-semibold">{t.mapTitle(cityName)}</h2>
            <span className="text-zinc-500 text-sm">{t.mapSubtitle(points.length)}</span>
          </div>
          <CityMapSvg
            points={mapDots}
            fallbackCenter={city.center}
            condoLinkPrefix={`/${lang}/condo/`}
            cityName={cityName}
          />
        </section>
      )}

      {/* Super Value */}
      {superValuePicks.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-widest mb-1 text-emerald-400">
              {t.superValueEyebrow}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t.superValueTitle}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {t.superValueSubtitle(superValue, withBubble, cityName)}
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {superValuePicks.map((c) => (
              <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} size="sm" />
            ))}
          </div>
        </section>
      )}

      {/* Overpriced watch */}
      {overpriced.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-widest mb-1 text-rose-400">
              {t.bubbleEyebrow}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t.bubbleTitle}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">{t.bubbleSubtitle}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {overpriced.map((c) => (
              <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} size="sm" />
            ))}
          </div>
        </section>
      )}

      {/* Full inventory */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-semibold">{t.fullInventoryTitle(cityName)}</h2>
          <span className="text-zinc-500 text-sm">{t.fullInventoryStat(total)}</span>
        </div>
        {condos.length === 0 ? (
          <div className="text-zinc-500 text-sm">{t.pendingPipeline}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {gridCondos.map((c) => (
                <BuildingCard
                  key={c.id}
                  condo={c}
                  hrefPrefix={`/${lang}/condo/`}
                  size="sm"
                />
              ))}
            </div>
            {condos.length > gridCondos.length && (
              <div className="mt-4 text-center">
                <Link
                  href={`/${lang}/inventory?city=${slug}`}
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {t.fullInventoryStat(total)} →
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* Retiree lens CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href={`/${lang}/retiree/${slug}`}
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 hover:border-zinc-600 transition group"
        >
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
              {t.retireeLensLabel}
            </div>
            <div className="text-zinc-100 font-semibold group-hover:text-emerald-400 transition">
              {t.retireeLensCta(city.name[lang as Lang])}
            </div>
            <div className="text-zinc-500 text-xs mt-0.5">
              {t.retireeLensSub}
            </div>
          </div>
        </Link>
      </section>

      {/* Concierge CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <LeadCaptureCTA
          headline={t.conciergeHeadline(city.name[lang as Lang])}
        />
      </section>

      {/* Travel affiliate — viewing trip booking */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <TravelAffiliateCard
          surface={`city-${slug}`}
          destination={city.name[lang as Lang]}
          framing={t.travelFraming(city.name[lang as Lang])}
          ctaText={t.travelCta}
        />
      </section>

      {/* FAQ — AEO surface */}
      {lang === "en" && (() => {
        const superValuePct = withBubble > 0 ? Math.round((superValue / withBubble) * 100) : null;
        const faqItems = [
          {
            q: `How many condo buildings does RealData track in ${city.name.en}?`,
            a: `RealData tracks ${total} condo buildings in ${city.name.en} across ${districts.size} sub-areas, sourced from hipflat. ${withBubble} buildings have a Bubble Index score (price vs. district average).`,
          },
          {
            q: `How do I find underpriced condos in ${city.name.en}?`,
            a: `RealData's Bubble Index measures each building's median price-per-sqm against its district average. A Bubble Index below 90 means the building is priced below the local market. Currently ${superValuePct != null ? superValuePct + "% of scored buildings" : "a subset"} in ${city.name.en} qualify as Super Value — underpriced AND with top-quartile livability scores. Look for the ★ Super Value badge on building cards.`,
          },
          {
            q: `Can foreigners buy condos in ${city.name.en}?`,
            a: `Yes, with restrictions. Thai law caps foreign ownership at 49% of total floor area per building (Condominium Act Section 19). Foreigners can only purchase units in the 'foreign quota' portion. RealData surfaces the measured foreign-quota inventory share on each building page — so buyers can see at a glance whether a project still has foreign-eligible units.`,
          },
          {
            q: `What data sources does RealData use for ${city.name.en} condos?`,
            a: `Listings and prices are sourced from hipflat.co.th with weekly re-crawls. Macro benchmarks (MRR, MLR, policy rate) come from Bank of Thailand BTWS_STAT API, refreshed daily. Flood risk (Bangkok only) uses BMA Drainage Department records, JICA reports, and 2011 great flood inundation maps. Transit and amenity data comes from OpenStreetMap via Overpass API. No developer money, no paid placement.`,
          },
        ];
        const faqJsonLd = buildFaqJsonLd(faqItems);
        return (
          <>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
            />
            <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-zinc-900">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
                Frequently asked questions
              </h2>
              <dl className="space-y-3 max-w-3xl">
                {faqItems.map((f) => (
                  <div key={f.q} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <dt className="font-semibold text-zinc-100 mb-2">{f.q}</dt>
                    <dd className="text-zinc-400 text-sm leading-relaxed">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        );
      })()}

      {/* Other cities */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-zinc-900">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.otherCitiesHeader}
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {([{ slug: "bangkok", name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" }, href: `/${lang}` }] as Array<{
            slug: string;
            name: { en: string; ko: string; th: string };
            href: string;
          }>)
            .concat(
              CITIES.filter((c) => c.slug !== slug).map((c: City) => ({
                slug: c.slug,
                name: c.name,
                href: `/${lang}/city/${c.slug}`,
              }))
            )
            .map((c) => (
              <Link
                key={c.slug}
                href={c.href}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition"
              >
                <div className="font-bold text-zinc-100">{c.name[lang]}</div>
                <div className="text-xs text-zinc-500 mt-1">→</div>
              </Link>
            ))}
        </div>
      </section>
    </main>
  );
}
