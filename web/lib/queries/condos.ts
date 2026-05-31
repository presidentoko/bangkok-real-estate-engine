// Centralized condo queries. Each function returns a typed shape that the
// UI consumes directly — no more inline `as unknown as` casts in pages.
//
// Caching policy
// --------------
// Queries are wrapped in `unstable_cache` with a default 1h revalidate. That
// keeps Supabase egress within the free tier even under steady traffic; the
// scrapers run once a week, so 1h staleness is well below the data refresh
// cadence. Pages that need fresher numbers can pass a shorter `revalidate`
// to the call site (or use the `noCache` variant).

import { unstable_cache } from "next/cache";
import { cityProvinceSlugs } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";

const PAGE = 1000; // PostgREST per-request cap.

export type PropertyType = "condo" | "apartment" | "serviced-apartment";

export type CondoSummary = {
  id: string;
  name: string;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  province: string;
  hero_image_url: string | null;
  bubble_index: number | null;
  is_super_value: boolean | null;
  flood_risk_level: number | null;
  total_units: number | null;
  available_units_count: number | null;
  market_sale_median: number | null;
  market_rent_median: number | null;
  market_summary_currency: string | null;
  property_type: PropertyType;
  source: string;
};

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

const SELECT =
  "id, name, url, latitude, longitude, hero_image_url, total_units, " +
  "available_units_count, market_sale_median, market_rent_median, " +
  "market_summary_currency, property_type, province, source, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

// Pulls every published row from every source. Hipflat remains the trusted
// scoring source (it's the only one with bubble_index + value_scores), so
// non-hipflat rows surface with `bubble_index=null` — the UI renders a
// "no score" placeholder for those. This is intentional: we'd rather show
// a real building with a portal badge than pretend the inventory is empty.
async function _fetchAllCondos(): Promise<CondoSummary[]> {
  const supabase = getServerSupabase();
  const out: CondoSummary[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("condos_published")
      .select(SELECT)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`condo fetch failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Joined[];
    out.push(...rows.map(flatten));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

export const fetchAllCondos = unstable_cache(
  _fetchAllCondos,
  ["condos:all"],
  { revalidate: 3600, tags: ["condos"] }
);

// ---------------------------------------------------------------------------
// City-scoped inventory feed
// ---------------------------------------------------------------------------
// The inventory page + /api/condos/inventory previously called fetchAllCondos()
// (every row, every source, ~6.4MB) and filtered to one city in JS. That blew
// past the 2MB unstable_cache ceiling — so nothing cached and every request
// re-pulled the whole table from Supabase (page TTFB ~2.4s, API ~39s).
//
// These two helpers scope the fetch to a single city *at the DB level* and drop
// the `url` + `available_units_count` columns the inventory UI never reads. That
// roughly halves the bytes vs. the all-cities pull and lets smaller cities cache
// cleanly; Bangkok may still exceed 2MB (hero-image URLs dominate), so the API
// route additionally leans on its CDN `s-maxage` header for the edge cache.

// Lean projection: no `url`, no `available_units_count` (unused by the grid /
// cards / dashboard stats). Keeps lat/lng for the geo-located stat.
const SELECT_LEAN =
  "id, name, latitude, longitude, hero_image_url, total_units, " +
  "market_sale_median, market_rent_median, market_summary_currency, " +
  "property_type, province, source, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

async function _fetchCondoSummariesByCity(citySlug: string): Promise<CondoSummary[]> {
  const supabase = getServerSupabase();
  const provinces = cityProvinceSlugs(citySlug);
  const out: CondoSummary[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("condos_published")
      .select(SELECT_LEAN)
      .in("province", provinces)
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`city condo fetch failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Joined[];
    out.push(...rows.map(flatten));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

// `citySlug` is part of the cache key automatically — Next.js includes the
// function arguments alongside the keyParts.
export const fetchCondoSummariesByCity = unstable_cache(
  _fetchCondoSummariesByCity,
  ["condos:by-city"],
  { revalidate: 3600, tags: ["condos"] }
);

// Cheap province-only pull (no joins, no long strings) used to render the
// per-city count chips without loading every condo's full payload. ~14k rows of
// a single short string ≈ 170KB → caches comfortably under the 2MB ceiling.
async function _fetchCondoProvinces(): Promise<string[]> {
  const supabase = getServerSupabase();
  const out: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("condos_published")
      .select("province")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`province fetch failed: ${error.message}`);
    const rows = (data ?? []) as Array<{ province: string | null }>;
    out.push(...rows.map((r) => r.province ?? "bangkok"));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

export const fetchCondoProvinces = unstable_cache(
  _fetchCondoProvinces,
  ["condos:provinces"],
  { revalidate: 3600, tags: ["condos"] }
);

async function _fetchCondo(id: string): Promise<CondoSummary | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("condos_published")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`condo fetch failed: ${error.message}`);
  if (!data) return null;
  return flatten(data as unknown as Joined);
}

export const fetchCondo = unstable_cache(
  _fetchCondo,
  ["condos:one"],
  { revalidate: 3600, tags: ["condos"] }
);

export type SiteStats = {
  buildings: number;
  listings: number;
  chartPoints: number;
  geoLocated: number;
  withBubble: number;
  superValue: number;
  withYield: number;
  totalCondos: number;
  totalListings: number;
  macroPoints: number;
};

async function _fetchSiteStats(): Promise<SiteStats> {
  const supabase = getServerSupabase();

  type CondoCountQuery = ReturnType<typeof makeBaseCondoCount>;
  function makeBaseCondoCount() {
    return supabase.from("condos_published").select("id", { count: "exact", head: true })
      .eq("source", "hipflat");
  }
  async function condosCount(extra?: (q: CondoCountQuery) => CondoCountQuery): Promise<number> {
    let q: CondoCountQuery = makeBaseCondoCount();
    if (extra) q = extra(q);
    const r = await q;
    return r.count ?? 0;
  }

  const [b, l, c, g, bi, sv, y, tc, tl, mi] = await Promise.all([
    condosCount(),
    supabase.from("listings").select("id", { count: "exact", head: true })
      .eq("source", "hipflat").then((r) => r.count ?? 0),
    supabase.from("condo_market_chart").select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    condosCount((q) => q.not("latitude", "is", null)),
    supabase.from("value_scores").select("condo_id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase.from("value_scores").select("condo_id", { count: "exact", head: true })
      .eq("is_super_value", true).then((r) => r.count ?? 0),
    supabase.from("condos").select("id", { count: "exact", head: true })
      .not("gross_yield_pct", "is", null).then((r) => r.count ?? 0),
    supabase.from("condos").select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase.from("listings").select("id", { count: "exact", head: true })
      .eq("is_active", true).then((r) => r.count ?? 0),
    supabase.from("macro_indicators").select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
  ]);
  return {
    buildings: b,
    listings: l,
    chartPoints: c,
    geoLocated: g,
    withBubble: bi,
    superValue: sv,
    withYield: y,
    totalCondos: tc,
    totalListings: tl,
    macroPoints: mi,
  };
}

export const fetchSiteStats = unstable_cache(
  _fetchSiteStats,
  ["stats"],
  { revalidate: 3600, tags: ["stats"] }
);
