import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingCard } from "@/components/BuildingCard";
import { CityMapSvg, type CityPoint } from "@/components/CityMapSvg";
import { CITIES, getCity, type City, type CitySlug } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, type Lang } from "@/lib/i18n";
import { type CondoSummary, type PropertyType } from "@/lib/queries/condos";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

const SELECT =
  "id, name, url, latitude, longitude, hero_image_url, total_units, " +
  "available_units_count, market_sale_median, market_rent_median, " +
  "market_summary_currency, property_type, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

type Joined = {
  id: string;
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
    name: r.name,
    url: r.url,
    latitude: r.latitude,
    longitude: r.longitude,
    region: regions?.name ?? null,
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
  };
}

async function fetchCityCondos(province: CitySlug): Promise<CondoSummary[]> {
  const supabase = getServerSupabase();
  const out: CondoSummary[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    // City pages query the base table directly, so an unpublished city can
    // still be previewed at /[lang]/city/{slug} before we flip published=true.
    const { data, error } = await supabase
      .from("condos")
      .select(SELECT)
      .eq("source", "hipflat")
      .eq("province", province)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`city condo fetch failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Joined[];
    out.push(...rows.map(flatten));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
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
      name: c.name,
      lat: c.latitude as number,
      lng: c.longitude as number,
      bubbleIndex: c.bubble_index,
      url: c.url,
    }));

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
      url: `${SEO_SITE_URL}/${lang}/condo/${c.id}`,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
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
            points={points}
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {superValuePicks.map((c) => (
              <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} />
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {overpriced.map((c) => (
              <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} />
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {condos.map((c) => (
              <BuildingCard
                key={c.id}
                condo={c}
                hrefPrefix={`/${lang}/condo/`}
                size="sm"
              />
            ))}
          </div>
        )}
      </section>

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
