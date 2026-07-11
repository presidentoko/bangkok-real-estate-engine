import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cache } from "react";
import sanitizeHtml from "sanitize-html";
import { CondoFacilities } from "@/components/CondoFacilities";
import { CondoNeighbours } from "@/components/CondoNeighbours";
import { CondoUnitsTable } from "@/components/CondoUnitsTable";
import { PriceChart } from "@/components/PriceChart";
import { ReportCard } from "@/components/ReportCard";
import { AirQualityCard } from "@/components/AirQualityCard";
import { CostOfOwnershipCard } from "@/components/CostOfOwnershipCard";
import { DeveloperCard } from "@/components/DeveloperCard";
import { GroundStabilityCard } from "@/components/GroundStabilityCard";
import { ForeignQuotaCard } from "@/components/ForeignQuotaCard";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { TravelAffiliateCard } from "@/components/TravelAffiliateCard";
import { MultiPortalCard } from "@/components/MultiPortalCard";
import { ResaleLiquidityCard } from "@/components/ResaleLiquidityCard";
import { RetireeSuitabilityCard } from "@/components/RetireeSuitabilityCard";
import { YieldCard } from "@/components/YieldCard";
import { decodeEntities } from "@/lib/decode";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getPortalStats } from "@/lib/queries/portals";
import {
  getCondoYield,
  getCurrentMortgageRate,
} from "@/lib/queries/yield";
import { canonicalCitySlug, getCity } from "@/lib/cities";
import { retireeSuitability } from "@/lib/retiree";
import { langAlternates } from "@/lib/seo";
import { buildBreadcrumbsJsonLd, buildCondoJsonLd, buildCondoSpeakableJsonLd } from "@/lib/seo/condoJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";
import { stationSlug } from "@/lib/stations";
import type { Livability, Risk, ValueScore } from "@/lib/types";
import { getViableStations } from "@/lib/queries/stations";
import { LinkShareButtons } from "@/components/LinkShareButtons";
import { SaveButton } from "@/components/SaveButton";
import { CompareButton } from "@/components/CompareButton";

// ~12,300 condos x 3 langs = ~37,000 distinct pages. Even at 24h, if
// crawlers touch most of them once a day that's >1M ISR regenerations a
// month on its own — confirmed 2026-07-10 (Vercel Hobby: 1.3M/200K ISR
// writes, 650% over). The underlying data only changes via weekly-refresh
// (Sundays) + a light Wednesday catch-pass, so daily regeneration was pure
// waste. 7 days matches the real data cadence and cuts regenerations ~7x.
export const revalidate = 604800;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Prebuild the 50 most-listed condos × 3 langs = 150 pages at build time.
// These are the pages most likely to be hit by search/social/AI crawlers —
// serving them as static HTML keeps function invocations off the free-plan
// budget. The long tail still falls back to on-demand ISR.
export async function generateStaticParams() {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("condos_published")
    .select("slug, active_listings_count")
    .not("slug", "is", null)
    .order("active_listings_count", { ascending: false, nullsFirst: false })
    .limit(50);
  const slugs = (data ?? []).map((r) => String(r.slug));
  return slugs.flatMap((slug) =>
    (["en", "ko", "th"] as const).map((lang) => ({ slug, lang }))
  );
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

// ---------------------------------------------------------------------------
// Per-request-deduped lookups
// ---------------------------------------------------------------------------
// generateMetadata() and the page body below both need the condo id (from
// slug), plus the value_scores / risk_factors rows for that condo. Next.js
// auto-dedupes identical `fetch()` calls within one request via its Data
// Cache, but this file talks to Supabase through supabase-js directly, which
// isn't fetch-shaped and doesn't get that dedup for free. Wrapping these
// lookups in React's `cache()` collapses the two call sites (metadata + page
// body) into a single Supabase round trip each, per request.
const getCondoIdBySlug = cache(async (slug: string): Promise<string | null> => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("condos_published")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
});

const getSlugByLegacyId = cache(async (id: string): Promise<string | null> => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("condos_published")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  return (data as { slug: string } | null)?.slug ?? null;
});

// Union of the columns generateMetadata() and the page body each need, so
// both call sites share one cached query against `condos_published` instead
// of running two overlapping (and both fairly wide) SELECTs on the same row.
const CONDO_FULL_SELECT =
  "id, name, developer, url, regions(name), latitude, longitude, " +
  "province, retiree_score, slug, " +
  "floors, total_units, completion_year, description, hero_image_url, " +
  "market_rent_median, market_rent_per_sqm, market_rent_yoy_pct, " +
  "market_sale_median, market_sale_per_sqm, market_sale_yoy_pct, " +
  "market_summary_currency, available_units_count, " +
  "active_listings_count, median_listing_dom_days, max_listing_dom_days, " +
  "cam_fee_per_month, sinking_fund, building_ownership, " +
  "aqi_score, pm25_value, aqi_station_name, aqi_fetched_at, " +
  "foreign_quota_listings_available, thai_quota_listings_available, " +
  "total_quota_listings_observed, foreign_quota_inventory_pct, " +
  "foreign_quota_fetched_at, " +
  "developer_slug, developer_project_count, developer_unit_count, " +
  "google_rating, google_review_count, gross_yield_pct";

const getCondoFullById = cache(async (id: string) => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("condos_published")
    .select(CONDO_FULL_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data;
});

// value_scores / risk_factors were both `select("*")` — narrowed to just the
// columns actually read anywhere on this page (page body + ReportCard /
// ResaleLiquidityCard / GroundStabilityCard props), after auditing every
// read site.
const VALUE_SCORE_SELECT =
  "bubble_index, is_super_value, liquidity_score, liquidity_grade, " +
  "liquidity_absorption_rate, liquidity_median_sold_dom, liquidity_sample_size";
const RISK_FACTORS_SELECT = "flood_risk_level, subsidence_level, subsidence_source";

const getValueScoreByCondoId = cache(async (id: string): Promise<ValueScore | null> => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("value_scores")
    .select(VALUE_SCORE_SELECT)
    .eq("condo_id", id)
    .maybeSingle();
  return data as unknown as ValueScore | null;
});

const getRiskFactorsByCondoId = cache(async (id: string): Promise<Risk | null> => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("risk_factors")
    .select(RISK_FACTORS_SELECT)
    .eq("condo_id", id)
    .maybeSingle();
  return data as unknown as Risk | null;
});

// AEO/SEO metadata. Each condo page gets a unique title + description that
// surfaces our differentiator (bubble_index, flood level) so search snippets
// and AI Overviews quote our data, not the listing source.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;

  // Legacy UUID URL — redirect to slug-based URL.
  if (UUID_RE.test(slug)) {
    const legacySlug = await getSlugByLegacyId(slug);
    if (legacySlug) redirect(`/${lang}/condo/${legacySlug}`);
    return { title: "Condo report — RealData" };
  }

  const id = await getCondoIdBySlug(slug);
  if (!id) return { title: "Condo report — RealData" };
  const condo = await getCondoFullById(id);
  if (!condo) return { title: "Condo report — RealData" };
  const condoForMeta = condo as unknown as { id: string; name: string; province: string | null; regions: { name: string } | { name: string }[] | null; market_sale_median: number | null; market_summary_currency: string | null; total_units: number | null; completion_year: number | null; gross_yield_pct: number | null };
  const [scoreMeta, riskMeta] = await Promise.all([
    getValueScoreByCondoId(id),
    getRiskFactorsByCondoId(id),
  ]);
  const c = condoForMeta;
  const region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? "Bangkok";
  const provinceDisplay = c.province
    ? c.province.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
    : "Bangkok";
  const above = scoreMeta?.bubble_index != null ? Math.round(scoreMeta.bubble_index - 100) : null;
  const aboveTxt =
    above == null
      ? null
      : above > 0
        ? `priced ${above}% above district avg`
        : above < 0
          ? `priced ${Math.abs(above)}% below district avg`
          : "at district average";
  const floodTxt =
    riskMeta?.flood_risk_level != null
      ? `flood risk L${riskMeta.flood_risk_level}/5`
      : null;
  const yieldTxt =
    c.gross_yield_pct != null ? `yield ${c.gross_yield_pct.toFixed(2)}%` : null;
  const titleSuffix = [yieldTxt, floodTxt].filter(Boolean).join(" · ") || `${provinceDisplay} condo`;
  const title = `${c.name}, ${region} — ${titleSuffix} | RealData`;
  const desc =
    `${c.name} in ${region}, ${provinceDisplay}. ` +
    [
      c.completion_year ? `built ${c.completion_year}` : null,
      c.total_units ? `${c.total_units} units` : null,
      yieldTxt,
      aboveTxt,
      floodTxt,
    ]
      .filter(Boolean)
      .join(" · ") +
    ". See listings, 13-month price trend, yield calculation, flood risk and amenities.";
  return {
    title,
    description: desc,
    alternates: {
      canonical: `${SITE_URL}/${lang}/condo/${slug}`,
      languages: langAlternates(`/condo/${slug}`),
    },
    openGraph: {
      title,
      description: desc,
      url: `${SITE_URL}/${lang}/condo/${slug}`,
      type: "article",
      images: [
        {
          url: `/${lang}/condo/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${c.name} — RealData Bangkok condo report`,
        },
      ],
    },
  };
}

export default async function CondoPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  const supabase = getServerSupabase();

  // Legacy UUID URL → 308 redirect to slug-based URL.
  if (UUID_RE.test(slug)) {
    const legacySlug = await getSlugByLegacyId(slug);
    if (legacySlug) permanentRedirect(`/${lang}/condo/${legacySlug}`);
    notFound();
  }

  // Step 1: resolve condo id from slug. Cached via React's cache() so this
  // reuses the lookup generateMetadata() already ran for this same request
  // instead of a second round trip.
  const id = await getCondoIdBySlug(slug);
  if (!id) notFound();

  const [
    condoData, scoreData, livRes, riskData, latestRes,
    listingsRes, chartRes, amenitiesRes, parkingRes, neighboursRes,
    yieldData, mortgageRate, portalStats,
  ] = await Promise.all([
    getCondoFullById(id),
    getValueScoreByCondoId(id),
    supabase
      .from("livability_metrics")
      .select(
        "nearest_bts_distance_m, nearest_bts_station, nearest_mrt_distance_m, " +
        "nearest_mrt_station, hospitals_within_1km, schools_within_1km, " +
        "supermarkets_within_1km"
      )
      .eq("condo_id", id)
      .maybeSingle(),
    getRiskFactorsByCondoId(id),
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

  if (!condoData) notFound();

  const livData = livRes.data as unknown as Livability | null;

  // supabase-js types `regions` as an array on joins; collapse to single.
  const condoRaw = condoData as unknown as {
    id: string;
    slug: string | null;
    name: string;
    developer: string | null;
    url: string | null;
    regions: { name: string } | { name: string }[] | null;
    province: string | null;
    retiree_score: number | null;
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
    cam_fee_per_month: number | null;
    sinking_fund: number | null;
    building_ownership: string | null;
    aqi_score: number | null;
    pm25_value: number | null;
    aqi_station_name: string | null;
    aqi_fetched_at: string | null;
    foreign_quota_listings_available: number | null;
    thai_quota_listings_available: number | null;
    total_quota_listings_observed: number | null;
    foreign_quota_inventory_pct: number | null;
    foreign_quota_fetched_at: string | null;
    developer_slug: string | null;
    developer_project_count: number | null;
    developer_unit_count: number | null;
    google_rating: number | null;
    google_review_count: number | null;
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

  const region = regions?.name ?? "Bangkok";

  // Retiree suitability — computed from livability + air-quality data the page
  // already holds (no DB column needed). Frames the building for the large
  // Thailand retirement-visa buyer segment. Declared here so the JSON-LD below
  // can cite the score.
  const transitDistances = [
    livData?.nearest_bts_distance_m,
    livData?.nearest_mrt_distance_m,
  ].filter((d): d is number => d != null);
  const nearestTransitM = transitDistances.length
    ? Math.min(...transitDistances)
    : null;
  const retiree = retireeSuitability({
    hospitalsWithin1km: livData?.hospitals_within_1km ?? null,
    aqiScore: condoRaw.aqi_score,
    supermarketsWithin1km: livData?.supermarkets_within_1km ?? null,
    nearestTransitM,
  });

  // Developer report-card roll-up (one extra lookup, keyed by the slug we
  // scraped). Null when this building has no developer or no stats row yet.
  const devStats = condoRaw.developer_slug
    ? (
        await supabase
          .from("developers")
          .select("tracked_buildings, avg_gross_yield_pct, avg_foreign_quota_pct")
          .eq("developer_slug", condoRaw.developer_slug)
          .maybeSingle()
      ).data as {
        tracked_buildings: number | null;
        avg_gross_yield_pct: number | null;
        avg_foreign_quota_pct: number | null;
      } | null
    : null;

  const jsonLd = buildCondoJsonLd({
    condo: condoRaw,
    region,
    amenities,
    signals: {
      bubble_index: scoreData?.bubble_index,
      flood_risk_level: riskData?.flood_risk_level,
      nearest_bts_distance_m: livData?.nearest_bts_distance_m,
      hospitals_within_1km: livData?.hospitals_within_1km,
      gross_yield_pct: yieldData?.gross_yield_pct,
      aqi_score: condoRaw.aqi_score,
      foreign_quota_inventory_pct: condoRaw.foreign_quota_inventory_pct,
      resale_liquidity_score: scoreData?.liquidity_score,
      retiree_suitability_score: retiree?.score ?? null,
      subsidence_level: riskData?.subsidence_level,
      developer_name: condoRaw.developer,
      developer_project_count: condoRaw.developer_project_count,
    },
    siteUrl: SITE_URL,
    lang,
  });
  const condoSlug = condoRaw.slug ?? slug;
  const breadcrumbsJsonLd = buildBreadcrumbsJsonLd({
    siteUrl: SITE_URL,
    lang,
    condoSlug,
    condoName: condoRaw.name,
    region,
    districtName: regions?.name ?? null,
  });
  const speakableJsonLd = buildCondoSpeakableJsonLd({
    siteUrl: SITE_URL,
    lang,
    condoSlug,
    condoName: condoRaw.name,
  });

  // Backlink target: this condo's nearest rail station spoke (only if viable).
  const stationName =
    livData?.nearest_bts_station || livData?.nearest_mrt_station || null;
  const stationSpokeSlug = stationName ? stationSlug(stationName) : null;
  const viableSlugs = new Set((await getViableStations()).map((s) => s.slug));
  const stationLinkOk = stationSpokeSlug != null && viableSlugs.has(stationSpokeSlug);

  // Per-condo FAQ — concrete numbers wherever we have them so the answer
  // is quotable as-is by Google AI Overviews / Perplexity / ChatGPT.
  const yieldVal = yieldData?.gross_yield_pct;
  const bubbleVal = scoreData?.bubble_index;
  const floodVal = riskData?.flood_risk_level;
  const subsidenceVal = riskData?.subsidence_level;
  const quotaVal = condoRaw.foreign_quota_inventory_pct;
  const aqiVal = condoRaw.aqi_score;
  const liqScore = scoreData?.liquidity_score;
  const liqAbsorb = scoreData?.liquidity_absorption_rate;
  const liqSold = scoreData?.liquidity_median_sold_dom;
  const mrr = mortgageRate?.rate ?? null;

  const faqItems: Array<{ q: string; a: string }> = [];
  if (yieldVal != null) {
    const spreadLine =
      mrr != null
        ? ` Versus the current Thai MRR of ${mrr.toFixed(2)}%, that is a ${yieldVal - mrr >= 0 ? "+" : ""}${(yieldVal - mrr).toFixed(2)}pp spread.`
        : "";
    faqItems.push({
      q: `What is the gross rental yield at ${condoRaw.name}?`,
      a:
        `Gross rental yield at ${condoRaw.name} is ${yieldVal.toFixed(2)}%, computed as ` +
        `(12 × median monthly rent) ÷ median sale price across our active listings.` +
        spreadLine +
        " This is a pre-tax, pre-vacancy figure — net yield is typically 1.5–3pp lower.",
    });
  }
  if (bubbleVal != null) {
    const dist = Math.round(bubbleVal - 100);
    const verdict =
      bubbleVal >= 130
        ? "bubble suspect"
        : bubbleVal < 80
          ? "underpriced"
          : "at-market";
    faqItems.push({
      q: `Is ${condoRaw.name} overpriced compared to the rest of ${region}?`,
      a:
        `${condoRaw.name} has a RealData Bubble Index of ${bubbleVal.toFixed(0)} — that is ` +
        `${Math.abs(dist)}% ${dist >= 0 ? "above" : "below"} the median price-per-sqm of the ${region} district, ` +
        `which we classify as ${verdict}.`,
    });
  }
  if (quotaVal != null) {
    faqItems.push({
      q: `Can foreigners buy a unit at ${condoRaw.name}?`,
      a:
        `Across the for-sale inventory we currently observe at ${condoRaw.name}, ` +
        `${quotaVal.toFixed(0)}% of the units are flagged "Foreign Quota" — meaning legally eligible for a non-Thai buyer. ` +
        `A higher share = more foreign-eligible inventory still available. Thai law caps foreign ownership at 49% of a building's total floor area, ` +
        `so foreign-quota units sell out faster than Thai-quota units in popular buildings.`,
    });
  }
  if (floodVal != null) {
    const floodLabel =
      floodVal >= 5
        ? "severe"
        : floodVal >= 4
          ? "waist-deep recurring"
          : floodVal >= 3
            ? "neighborhood-level common"
            : floodVal >= 2
              ? "occasional puddling"
              : floodVal >= 1
                ? "very low"
                : "none observed";
    faqItems.push({
      q: `What is the monsoon flood risk at ${condoRaw.name}?`,
      a:
        `${condoRaw.name} sits in a district with a RealData Flood Risk Level of ${floodVal}/5 — ${floodLabel}. ` +
        `Risk is district-level, drawn from Bangkok Metropolitan Administration Drainage Department records, JICA reports, ` +
        `and the 2011 great-flood inundation map. Individual buildings may still flood ground-level parking even in lower-risk districts.`,
    });
  }
  if (aqiVal != null) {
    const aqiVerdict =
      aqiVal >= 150
        ? "Unhealthy (PM2.5 elevated)"
        : aqiVal >= 100
          ? "Unhealthy for sensitive groups"
          : aqiVal >= 50
            ? "Moderate"
            : "Good";
    faqItems.push({
      q: `How is the air quality at ${condoRaw.name}?`,
      a:
        `Latest WAQI air quality reading near ${condoRaw.name} is ${aqiVal} — ${aqiVerdict}. ` +
        `This is the index value from the closest World Air Quality Index station; PM2.5 levels in Bangkok swing seasonally and can spike during burn season (Feb–April).`,
    });
  }
  if (liqScore != null) {
    const liqVerdict =
      liqScore >= 75
        ? "highly liquid — units here tend to find buyers quickly"
        : liqScore >= 55
          ? "liquid — resale demand is healthy"
          : liqScore >= 35
            ? "moderate — expect a normal marketing period"
            : liqScore >= 20
              ? "slow — your exit could take a while"
              : "illiquid — resale may be difficult";
    const absorbLine =
      liqAbsorb != null
        ? ` ${liqAbsorb.toFixed(0)}% of the for-sale supply we tracked here cleared the market.`
        : "";
    const soldLine =
      liqSold != null ? ` Listings that sold did so in about ${liqSold} days.` : "";
    faqItems.push({
      q: `Is ${condoRaw.name} easy to resell?`,
      a:
        `${condoRaw.name} has a RealData Resale Liquidity Score of ${liqScore.toFixed(0)}/100 — ${liqVerdict}.` +
        absorbLine +
        soldLine +
        " We compute this by tracking every listing from the day it appears to the day it leaves the market, so it reflects how much supply actually clears and how fast — not just the asking price. It is an availability signal, not a guarantee of sale price.",
    });
  }
  if (subsidenceVal != null) {
    const subLabel =
      subsidenceVal >= 5
        ? "severe (coastal subsidence plus sea-level rise)"
        : subsidenceVal >= 4
          ? "high (eastern soft-clay belt, documented sinking)"
          : subsidenceVal >= 3
            ? "moderate (transitional zone or historical hotspot)"
            : subsidenceVal >= 2
              ? "low (largely stabilised)"
              : "very low (consolidated inner core, effectively flat today)";
    faqItems.push({
      q: `Is the ground sinking at ${condoRaw.name}?`,
      a:
        `${condoRaw.name} sits in a district with a RealData Ground Stability (land-subsidence) level of ${subsidenceVal}/5 — ${subLabel}. ` +
        `Bangkok rests on soft marine clay and sank as fast as ~120mm/year in the 1980s from groundwater over-extraction; regulation has since cut inner-city rates to near zero, but the eastern belt and coastal south keep sinking. ` +
        `This is a district-level estimate from published InSAR and groundwater-monitoring studies, and it compounds the same areas' monsoon-flood risk over a 10–20 year horizon — not a per-building survey.`,
    });
  }
  if (retiree) {
    const retVerdict =
      retiree.grade === "excellent"
        ? "an excellent fit"
        : retiree.grade === "good"
          ? "a good fit"
          : retiree.grade === "fair"
            ? "a fair fit"
            : "less suited";
    const hosp = livData?.hospitals_within_1km;
    const hospLine =
      hosp != null
        ? ` There ${hosp === 1 ? "is" : "are"} ${hosp} hospital/clinic${hosp === 1 ? "" : "s"} within 1km`
        : "";
    const aqiLine = aqiVal != null ? `, and the latest air quality reads ${aqiVal} AQI` : "";
    faqItems.push({
      q: `Is ${condoRaw.name} a good place to retire?`,
      a:
        `${condoRaw.name} scores ${retiree.score.toFixed(0)}/100 on RealData's Retiree Suitability Score — ${retVerdict} for a retirement-visa buyer.` +
        hospLine +
        aqiLine +
        ". The score weights nearby healthcare and clean air most heavily, then car-free transit access and daily errands — the priorities that matter to retirees rather than young investors.",
    });
  }
  if (condoRaw.developer) {
    const pc = condoRaw.developer_project_count;
    const scaleLine =
      pc != null
        ? ` On FazWaz they list ${pc} project${pc === 1 ? "" : "s"}` +
          (condoRaw.developer_unit_count != null
            ? ` totalling ${condoRaw.developer_unit_count.toLocaleString()} units`
            : "") +
          (pc >= 20
            ? " — an established developer."
            : pc >= 5
              ? " — an experienced developer."
              : pc >= 2
                ? " — a smaller portfolio."
                : " — a new or single-project developer.")
        : "";
    faqItems.push({
      q: `Who is the developer of ${condoRaw.name}?`,
      a:
        `${condoRaw.name} was developed by ${condoRaw.developer}.` +
        scaleLine +
        " Portfolio scale is an experience proxy — a longer delivery record reduces completion risk on off-plan units, though it does not guarantee build quality on any single project.",
    });
  }
  faqItems.push({
    q: `How does RealData verify the numbers on this page?`,
    a:
      `Every figure is computed from live listing data we re-crawl across hipflat, dotproperty, ddproperty, and fazwaz (daily for Bangkok, weekly for the full Thailand sweep). ` +
      `District medians come from the same dataset, the mortgage benchmark is Bank of Thailand BTWS_STAT, and flood / livability layers are pinned to government and OpenStreetMap sources. ` +
      `We accept no payment from developers — the only revenue path is a flat referral if a reader hires a vetted broker through us.`,
  });
  const faqJsonLd = buildFaqJsonLd(faqItems);

  const condoCitySlug = canonicalCitySlug(condoRaw.province);
  const condoCityName = getCity(condoCitySlug)?.name[isLang(lang) ? lang : "en"] ?? condoCitySlug;

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Action row: save + share */}
      <div className="px-4 sm:px-6 pt-4 space-y-2">
        <div className="flex gap-2">
          <SaveButton id={condoRaw.id} name={condoRaw.name} />
          <CompareButton id={condoRaw.id} name={condoRaw.name} />
        </div>
        <LinkShareButtons
          url={`${SITE_URL}/${lang}/condo/${condoSlug}`}
          title={`${condoRaw.name} (${region}) — RealData report`}
        />
      </div>

      <div data-speakable="report-card">
        <ReportCard
          condo={{ ...condoRaw, regions }}
          score={scoreData}
          liv={livData}
          risk={riskData}
          latest={latestRes.data}
          lang={lang}
        />
      </div>

      {/* Building facts */}
      <section data-speakable="building-facts" className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
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
          <div
            className="text-zinc-400 text-sm mt-4 leading-relaxed [&_b]:text-zinc-300 [&_strong]:text-zinc-300"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(decodeEntities(condoRaw.description), {
                // Scraped third-party copy — allow only basic text formatting.
                // No attributes at all, so no onerror=/href="javascript:"/etc
                // vectors survive, unlike the old naive tag-stripping regex.
                allowedTags: ["b", "strong", "i", "em", "p", "br", "ul", "ol", "li", "span"],
                allowedAttributes: {},
                disallowedTagsMode: "discard",
              }),
            }}
          />
        )}
      </section>

      <DeveloperCard
        name={condoRaw.developer}
        slug={condoRaw.developer_slug}
        lang={lang}
        projectCount={condoRaw.developer_project_count}
        unitCount={condoRaw.developer_unit_count}
        trackedBuildings={devStats?.tracked_buildings ?? null}
        avgYield={devStats?.avg_gross_yield_pct ?? null}
        avgForeignQuota={devStats?.avg_foreign_quota_pct ?? null}
      />

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

      <ResaleLiquidityCard
        score={scoreData?.liquidity_score ?? null}
        grade={scoreData?.liquidity_grade ?? null}
        absorptionRate={scoreData?.liquidity_absorption_rate ?? null}
        medianSoldDom={scoreData?.liquidity_median_sold_dom ?? null}
        sampleSize={scoreData?.liquidity_sample_size ?? null}
      />

      <RetireeSuitabilityCard
        result={retiree}
        hospitals={livData?.hospitals_within_1km ?? null}
        aqi={condoRaw.aqi_score}
        supermarkets={livData?.supermarkets_within_1km ?? null}
        nearestTransitM={nearestTransitM}
      />

      {retiree != null && retiree.score >= 55 && (
        <Link
          href={`/${lang}/retiree/${condoCitySlug}`}
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 hover:border-zinc-600 transition group"
        >
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Retiree lens</div>
            <div className="text-zinc-100 font-semibold group-hover:text-emerald-400 transition">
              More retiree-friendly condos in {condoCityName} →
            </div>
            <div className="text-zinc-500 text-xs mt-0.5">
              Ranked by healthcare, air quality &amp; transit
            </div>
          </div>
        </Link>
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

      <CostOfOwnershipCard
        camFeePerMonth={condoRaw.cam_fee_per_month}
        sinkingFund={condoRaw.sinking_fund}
        ownership={condoRaw.building_ownership}
        avgMonthlyRent={yieldData?.avg_monthly_rent ?? null}
      />

      <ForeignQuotaCard
        foreignListings={condoRaw.foreign_quota_listings_available}
        thaiListings={condoRaw.thai_quota_listings_available}
        totalListings={condoRaw.total_quota_listings_observed}
        foreignPct={condoRaw.foreign_quota_inventory_pct}
        fetchedAt={condoRaw.foreign_quota_fetched_at}
      />

      <AirQualityCard
        aqi={condoRaw.aqi_score}
        pm25={condoRaw.pm25_value}
        stationName={condoRaw.aqi_station_name}
        fetchedAt={condoRaw.aqi_fetched_at}
      />

      <GroundStabilityCard
        level={riskData?.subsidence_level ?? null}
        source={riskData?.subsidence_source ?? null}
      />

      <MultiPortalCard stats={portalStats} />

      {chart.length > 0 && <PriceChart points={chart} />}

      {listings.length > 0 && <CondoUnitsTable listings={listings} />}

      {(amenities.length > 0 || parkingFacts.length > 0) && (
        <CondoFacilities amenities={amenities} parkingFacts={parkingFacts} />
      )}

      {neighbours.length > 0 && <CondoNeighbours neighbours={neighbours} />}

      <LeadCaptureCTA condoId={condoRaw.id} condoName={condoRaw.name} />

      <TravelAffiliateCard
        surface={`condo-${condoRaw.id.slice(0, 8)}`}
        destination={region}
        framing={`Planning to inspect ${condoRaw.name} in person? Book a hotel + flight in one search — ${region} stays are usually cheaper than the condo's own short-let pricing.`}
        ctaText="Find a hotel near this building →"
      />

      {/* Bottom share — visible after reading the full report */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="text-sm font-semibold text-zinc-300">Found this useful? Share the report</div>
        <LinkShareButtons
          url={`${SITE_URL}/${lang}/condo/${condoSlug}`}
          title={`${condoRaw.name} (${region}) — RealData report`}
        />
      </div>

      <section className="text-sm">
        <div className="text-zinc-300 font-semibold mb-1">Nearby &amp; metrics</div>
        <ul className="text-blue-400 space-y-1">
          {regions?.name && (
            <li>
              {/* District URLs use the raw region name as their slug (see
                  app/[lang]/district/[slug]/page.tsx), encoded the same way
                  the breadcrumb JSON-LD and sitemap-areas.xml do. */}
              <Link href={`/${lang}/district/${encodeURIComponent(regions.name)}`}>
                {lang === "ko"
                  ? `${region} 지역 콘도 전체 보기`
                  : lang === "th"
                    ? `ดูคอนโดทั้งหมดในย่าน${region}`
                    : `More condos in ${region}`}
              </Link>
            </li>
          )}
          {stationLinkOk && stationName && (
            <li><Link href={`/${lang}/near/${stationSpokeSlug}`}>Condos near {stationName} station</Link></li>
          )}
          {(() => {
            const citySlug = condoRaw.province != null ? canonicalCitySlug(condoRaw.province) : null;
            const cityObj = citySlug ? getCity(citySlug) : null;
            if (!cityObj || (condoRaw.retiree_score ?? 0) < 55) return null;
            return (
              <li>
                <Link href={`/${lang}/retiree/${citySlug}`}>
                  More retiree-friendly condos in {cityObj.name.en}
                </Link>
              </li>
            );
          })()}
          <li><Link href={`/${lang}/glossary/bubble-index`}>What is the Bubble Index?</Link></li>
          <li><Link href={`/${lang}/glossary/gross-yield`}>What is gross yield?</Link></li>
          <li><Link href={`/${lang}/glossary/resale-liquidity`}>What is the Resale Liquidity Score?</Link></li>
          <li><Link href={`/${lang}/glossary/retiree-suitability`}>Is it good for retirees?</Link></li>
          <li><Link href={`/${lang}/glossary/flood-risk-level`}>How we score flood risk</Link></li>
          <li><Link href={`/${lang}/glossary/ground-stability`}>Is the ground sinking?</Link></li>
          <li><Link href={`/${lang}/glossary/developer-track-record`}>What is a developer track record?</Link></li>
        </ul>
      </section>

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
