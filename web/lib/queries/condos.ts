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

const SELECT =
  "id, name, url, latitude, longitude, hero_image_url, total_units, " +
  "available_units_count, market_sale_median, market_rent_median, " +
  "market_summary_currency, property_type, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

async function _fetchAllCondos(): Promise<CondoSummary[]> {
  const supabase = getServerSupabase();
  const out: CondoSummary[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("condos_published")
      .select(SELECT)
      .eq("source", "hipflat")
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

  const [b, l, c, g, bi, sv] = await Promise.all([
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
  ]);
  return {
    buildings: b,
    listings: l,
    chartPoints: c,
    geoLocated: g,
    withBubble: bi,
    superValue: sv,
  };
}

export const fetchSiteStats = unstable_cache(
  _fetchSiteStats,
  ["stats"],
  { revalidate: 3600, tags: ["stats"] }
);
