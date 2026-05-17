import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CondoFacilities } from "@/components/CondoFacilities";
import { CondoNeighbours } from "@/components/CondoNeighbours";
import { CondoUnitsTable } from "@/components/CondoUnitsTable";
import { PriceChart } from "@/components/PriceChart";
import { ReportCard } from "@/components/ReportCard";
import { MultiPortalCard } from "@/components/MultiPortalCard";
import { YieldCard } from "@/components/YieldCard";
import { decodeEntities } from "@/lib/decode";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getPortalStats } from "@/lib/queries/portals";
import {
  getCondoYield,
  getCurrentMortgageRate,
} from "@/lib/queries/yield";
import { langAlternates } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// AEO/SEO metadata. Each condo page gets a unique title + description that
// surfaces our differentiator (bubble_index, flood level) so search snippets
// and AI Overviews quote our data, not the listing source.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}): Promise<Metadata> {
  const { id, lang } = await params;
  const supabase = getServerSupabase();
  const [{ data: condo }, { data: score }, { data: risk }] = await Promise.all([
    supabase
      .from("condos_published")
      .select("name, regions(name), market_sale_median, market_summary_currency, total_units, completion_year")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("value_scores").select("bubble_index").eq("condo_id", id).maybeSingle(),
    supabase.from("risk_factors").select("flood_risk_level").eq("condo_id", id).maybeSingle(),
  ]);
  if (!condo) return { title: "Condo report — RealData" };
  const c = condo as unknown as {
    name: string;
    regions: { name: string } | { name: string }[] | null;
    market_sale_median: number | null;
    market_summary_currency: string | null;
    total_units: number | null;
    completion_year: number | null;
  };
  const region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? "Bangkok";
  const above = score?.bubble_index != null ? Math.round(score.bubble_index - 100) : null;
  const aboveTxt =
    above == null
      ? null
      : above > 0
        ? `priced ${above}% above district avg`
        : above < 0
          ? `priced ${Math.abs(above)}% below district avg`
          : "at district average";
  const floodTxt =
    risk?.flood_risk_level != null
      ? `flood risk L${risk.flood_risk_level}/5`
      : null;
  const title = `${c.name} (${region}) — RealData report`;
  const desc =
    `${c.name} in ${region}, Bangkok. ` +
    [
      c.completion_year ? `built ${c.completion_year}` : null,
      c.total_units ? `${c.total_units} units` : null,
      aboveTxt,
      floodTxt,
    ]
      .filter(Boolean)
      .join(" · ") +
    ". Independent data report — listings, 13-month price trend, amenities, flood risk.";
  return {
    title,
    description: desc,
    alternates: {
      canonical: `${SITE_URL}/${lang}/condo/${id}`,
      languages: langAlternates(`/condo/${id}`),
    },
    openGraph: {
      title,
      description: desc,
      url: `${SITE_URL}/${lang}/condo/${id}`,
      type: "article",
    },
  };
}

export default async function CondoPage({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  const { id, lang } = await params;
  const supabase = getServerSupabase();

  const [
    condoRes, scoreRes, livRes, riskRes, latestRes,
    listingsRes, chartRes, amenitiesRes, parkingRes, neighboursRes,
    yieldData, mortgageRate, portalStats,
  ] = await Promise.all([
    supabase
      .from("condos_published")
      .select(
        "id, name, developer, url, regions(name), latitude, longitude, " +
        "floors, total_units, completion_year, description, hero_image_url, " +
        "market_rent_median, market_rent_per_sqm, market_rent_yoy_pct, " +
        "market_sale_median, market_sale_per_sqm, market_sale_yoy_pct, " +
        "market_summary_currency, available_units_count, " +
        "active_listings_count, median_listing_dom_days, max_listing_dom_days"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("value_scores").select("*").eq("condo_id", id).maybeSingle(),
    supabase
      .from("livability_metrics")
      .select("*")
      .eq("condo_id", id)
      .maybeSingle(),
    supabase.from("risk_factors").select("*").eq("condo_id", id).maybeSingle(),
    supabase
      .from("v_latest_listings")
      .select("price, area_sqm, price_per_sqm")
      .eq("condo_id", id)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("listing_type, price, currency, area_sqm, price_per_sqm, " +
              "bedrooms, bathrooms, floor_level, publisher, listing_url, source_unit_id")
      .eq("condo_id", id)
      .eq("source", "hipflat")
      .order("price", { ascending: true })
      .range(0, 199),
    supabase
      .from("condo_market_chart")
      .select("period, metric, currency, year_month, value")
      .eq("condo_id", id)
      .order("year_month", { ascending: true })
      .range(0, 199),
    supabase
      .from("condo_amenities")
      .select("name")
      .eq("condo_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("condo_parking_facts")
      .select("fact_key, fact_value")
      .eq("condo_id", id),
    supabase
      .from("condo_neighbours")
      .select("neighbour_slug, neighbour_url, neighbour_name")
      .eq("condo_id", id)
      .range(0, 19),
    getCondoYield(supabase, id),
    getCurrentMortgageRate(supabase),
    getPortalStats(supabase, id),
  ]);

  if (!condoRes.data) notFound();

  // supabase-js types `regions` as an array on joins; collapse to single.
  const condoRaw = condoRes.data as unknown as {
    id: string;
    name: string;
    developer: string | null;
    url: string | null;
    regions: { name: string } | { name: string }[] | null;
    latitude: number | null;
    longitude: number | null;
    floors: number | null;
    total_units: number | null;
    completion_year: number | null;
    description: string | null;
    hero_image_url: string | null;
    market_rent_median: number | null;
    market_rent_per_sqm: number | null;
    market_rent_yoy_pct: number | null;
    market_sale_median: number | null;
    market_sale_per_sqm: number | null;
    market_sale_yoy_pct: number | null;
    market_summary_currency: string | null;
    available_units_count: number | null;
    active_listings_count: number | null;
    median_listing_dom_days: number | null;
    max_listing_dom_days: number | null;
  };
  const regions = Array.isArray(condoRaw.regions)
    ? condoRaw.regions[0] ?? null
    : condoRaw.regions;

  const listings = (listingsRes.data ?? []) as unknown as Array<{
    listing_type: string;
    price: number;
    currency: string;
    area_sqm: number | null;
    price_per_sqm: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    floor_level: number | null;
    publisher: string | null;
    listing_url: string | null;
    source_unit_id: string | null;
  }>;
  const chart = (chartRes.data ?? []) as Array<{
    period: string;
    metric: string;
    currency: string | null;
    year_month: string;
    value: number;
  }>;
  const amenities = (amenitiesRes.data ?? []).map((a) => (a as { name: string }).name);
  const parkingFacts = (parkingRes.data ?? []) as Array<{ fact_key: string; fact_value: string | null }>;
  const neighbours = (neighboursRes.data ?? []) as Array<{ neighbour_slug: string; neighbour_url: string; neighbour_name: string | null }>;

  const yoyRent = condoRaw.market_rent_yoy_pct;
  const yoySale = condoRaw.market_sale_yoy_pct;
  const currency = condoRaw.market_summary_currency || "USD";
  const tCondo = getDictionary(isLang(lang) ? lang : "en").condoPage;

  // JSON-LD — describes the condo as ApartmentComplex (Schema.org) but with
  // our analytical fields (bubble_index, flood_risk_level) attached as
  // additionalProperty. Designed so AI Overviews and Perplexity can cite the
  // numeric verdicts.
  const region = regions?.name ?? "Bangkok";
  const additionalProps: Array<{ "@type": string; name: string; value: string | number }> = [];
  if (scoreRes.data?.bubble_index != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Bubble Index (district avg = 100)",
      value: scoreRes.data.bubble_index,
    });
  }
  if (riskRes.data?.flood_risk_level != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "RealData Flood Risk (0-5)",
      value: riskRes.data.flood_risk_level,
    });
  }
  if (livRes.data?.nearest_bts_distance_m != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Distance to nearest BTS (m)",
      value: livRes.data.nearest_bts_distance_m,
    });
  }
  if (livRes.data?.hospitals_within_1km != null) {
    additionalProps.push({
      "@type": "PropertyValue",
      name: "Hospitals within 1km",
      value: livRes.data.hospitals_within_1km,
    });
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: condoRaw.name,
    url: `${SITE_URL}/${lang}/condo/${condoRaw.id}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: region,
      addressRegion: "Bangkok",
      addressCountry: "TH",
    },
    ...(condoRaw.latitude != null && condoRaw.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: condoRaw.latitude,
            longitude: condoRaw.longitude,
          },
        }
      : {}),
    ...(condoRaw.total_units != null
      ? {
          numberOfAccommodationUnits: {
            "@type": "QuantitativeValue",
            value: condoRaw.total_units,
          },
        }
      : {}),
    ...(condoRaw.available_units_count != null
      ? {
          numberOfAvailableAccommodationUnits: {
            "@type": "QuantitativeValue",
            value: condoRaw.available_units_count,
          },
        }
      : {}),
    ...(amenities.length
      ? { amenityFeature: amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a })) }
      : {}),
    ...(additionalProps.length ? { additionalProperty: additionalProps } : {}),
  };

  // Breadcrumbs help SERP show RealData → Bangkok → {region} → {condo} as a
  // path. Big CTR win for AI Overviews and rich results.
  const breadcrumbsJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "RealData", item: `${SITE_URL}/${lang}` },
      { "@type": "ListItem", position: 2, name: "Inventory", item: `${SITE_URL}/${lang}/inventory` },
      { "@type": "ListItem", position: 3, name: region, item: `${SITE_URL}/${lang}/inventory` },
      { "@type": "ListItem", position: 4, name: condoRaw.name, item: `${SITE_URL}/${lang}/condo/${condoRaw.id}` },
    ],
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      <ReportCard
        condo={{ ...condoRaw, regions }}
        score={scoreRes.data}
        liv={livRes.data}
        risk={riskRes.data}
        latest={latestRes.data}
        lang={lang}
      />

      {/* Building facts */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          {tCondo.buildingFacts}
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500 text-xs">{tCondo.floors}</dt>
            <dd className="text-zinc-100 font-semibold tabular-nums">
              {condoRaw.floors ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 text-xs">{tCondo.totalUnits}</dt>
            <dd className="text-zinc-100 font-semibold tabular-nums">
              {condoRaw.total_units ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 text-xs">{tCondo.completed}</dt>
            <dd className="text-zinc-100 font-semibold tabular-nums">
              {condoRaw.completion_year ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 text-xs">{tCondo.availableNow}</dt>
            <dd className="text-zinc-100 font-semibold tabular-nums">
              {condoRaw.available_units_count ?? "—"}
            </dd>
          </div>
        </dl>
        {condoRaw.description && (
          <p className="text-zinc-400 text-sm mt-4 leading-relaxed">
            {decodeEntities(condoRaw.description)}
          </p>
        )}
      </section>

      {/* Listing activity (days-on-market) */}
      {condoRaw.active_listings_count != null && condoRaw.active_listings_count > 0 && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">
            {tCondo.marketActivityTitle}
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-zinc-500 text-xs">{tCondo.activeListings}</dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">
                {condoRaw.active_listings_count}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">{tCondo.medianDom}</dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">
                {condoRaw.median_listing_dom_days != null && condoRaw.median_listing_dom_days > 0
                  ? tCondo.domDays(condoRaw.median_listing_dom_days)
                  : tCondo.domNew}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 text-xs">{tCondo.maxDom}</dt>
              <dd className="text-zinc-100 font-semibold tabular-nums">
                {condoRaw.max_listing_dom_days != null && condoRaw.max_listing_dom_days > 0
                  ? tCondo.domDays(condoRaw.max_listing_dom_days)
                  : tCondo.domNew}
              </dd>
            </div>
          </dl>
          {(condoRaw.median_listing_dom_days ?? 0) < 7 && (
            <p className="text-zinc-500 text-xs mt-3 italic">
              {tCondo.domBuilding}
            </p>
          )}
        </section>
      )}

      {/* Market summary */}
      {(condoRaw.market_rent_median || condoRaw.market_sale_median) && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">
            {tCondo.marketSignals}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {condoRaw.market_sale_median != null && (
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  {tCondo.saleMedian}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {currency} {condoRaw.market_sale_median.toLocaleString()}
                </div>
                {condoRaw.market_sale_per_sqm != null && (
                  <div className="text-zinc-400 text-xs">
                    {currency} {condoRaw.market_sale_per_sqm.toLocaleString()}/sqm
                  </div>
                )}
                {yoySale != null && (
                  <div
                    className={`text-xs mt-1 ${
                      yoySale > 0 ? "text-emerald-400" : yoySale < 0 ? "text-rose-400" : "text-zinc-400"
                    }`}
                  >
                    {yoySale > 0 ? "▲" : yoySale < 0 ? "▼" : "—"}{" "}
                    {Math.abs(yoySale).toFixed(1)}% YoY
                  </div>
                )}
              </div>
            )}
            {condoRaw.market_rent_median != null && (
              <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  {tCondo.rentMedian}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {currency} {condoRaw.market_rent_median.toLocaleString()}
                  <span className="text-sm text-zinc-500 font-normal">/mo</span>
                </div>
                {condoRaw.market_rent_per_sqm != null && (
                  <div className="text-zinc-400 text-xs">
                    {currency} {condoRaw.market_rent_per_sqm.toLocaleString()}/sqm
                  </div>
                )}
                {yoyRent != null && (
                  <div
                    className={`text-xs mt-1 ${
                      yoyRent > 0 ? "text-emerald-400" : yoyRent < 0 ? "text-rose-400" : "text-zinc-400"
                    }`}
                  >
                    {yoyRent > 0 ? "▲" : yoyRent < 0 ? "▼" : "—"}{" "}
                    {Math.abs(yoyRent).toFixed(1)}% YoY
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <YieldCard yieldData={yieldData} mortgageRate={mortgageRate} />

      <MultiPortalCard stats={portalStats} />

      {chart.length > 0 && <PriceChart points={chart} />}

      {listings.length > 0 && <CondoUnitsTable listings={listings} />}

      {(amenities.length > 0 || parkingFacts.length > 0) && (
        <CondoFacilities amenities={amenities} parkingFacts={parkingFacts} />
      )}

      {neighbours.length > 0 && <CondoNeighbours neighbours={neighbours} />}

      {condoRaw.url && (
        <div className="text-xs text-zinc-500">
          Source:{" "}
          <a
            href={condoRaw.url}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:underline break-all"
          >
            {condoRaw.url}
          </a>
        </div>
      )}
    </main>
  );
}
