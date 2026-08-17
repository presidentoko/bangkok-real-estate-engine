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
import { encodeCompact, warnIfNearCacheCeiling, type CompactCondoSummaries } from "@/lib/condo-compact";
import { getServerSupabase } from "@/lib/supabase";

const PAGE = 1000; // PostgREST per-request cap.

export type PropertyType = "condo" | "apartment" | "serviced-apartment";

export type CondoSummary = {
  id: string;
  slug: string | null;
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

const SELECT =
  "id, slug, name, url, latitude, longitude, hero_image_url, total_units, " +
  "available_units_count, market_sale_median, market_rent_median, " +
  "market_summary_currency, property_type, province, source, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

// ---------------------------------------------------------------------------
// City-scoped inventory feed
// ---------------------------------------------------------------------------
// A prior fetchAllCondos() (every row, every source, ~6.4MB, filtered to one
// city in JS) blew past the 2MB unstable_cache ceiling — so nothing cached
// and every request re-pulled the whole table from Supabase (page TTFB
// ~2.4s, API ~39s). Removed 2026-07-25 once nothing called it anymore: an
// unused all-cities/all-columns query is a landmine, not dead weight — any
// future caller reaching for "just pull everything" reintroduces the exact
// bug class this file exists to avoid. Scope every fetch to a city (or use
// the compact-encoded feeds below) instead.
//
// These two helpers scope the fetch to a single city *at the DB level* and drop
// the `url` + `available_units_count` columns the inventory UI never reads. That
// roughly halves the bytes vs. the all-cities pull and lets smaller cities cache
// cleanly; Bangkok may still exceed 2MB (hero-image URLs dominate), so the API
// route additionally leans on its CDN `s-maxage` header for the edge cache.

// Lean projection: no `url`, no `available_units_count` (unused by the grid /
// cards / dashboard stats). Keeps lat/lng for the geo-located stat.
const SELECT_LEAN =
  "id, slug, name, latitude, longitude, hero_image_url, total_units, " +
  "market_sale_median, market_rent_median, market_summary_currency, " +
  "property_type, province, source, regions(name), " +
  "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

async function _fetchCondoSummariesByCity(citySlug: string): Promise<CondoSummary[]> {
  const supabase = getServerSupabase();
  const provinces = cityProvinceSlugs(citySlug);

  // Count first, then fan the page fetches out in PARALLEL. Bangkok has ~6k
  // rows = 7 sequential 1000-row round-trips the old way (~8s on a cache miss,
  // which is what left the grid stuck on skeletons). Parallel ranges collapse
  // that to roughly two round-trips of latency. Falls back to a sequential walk
  // if the exact count isn't available.
  const { count, error: countErr } = await supabase
    .from("condos_published")
    .select("id", { count: "exact", head: true })
    .in("province", provinces);

  if (countErr || count == null) {
    const out: CondoSummary[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("condos_published")
        .select(SELECT_LEAN)
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
  }

  const pages = Math.max(1, Math.ceil(count / PAGE));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase
        .from("condos_published")
        .select(SELECT_LEAN)
        .in("province", provinces)
        .order("id")
        .range(i * PAGE, i * PAGE + PAGE - 1)
    )
  );
  const out: CondoSummary[] = [];
  for (const { data, error } of results) {
    if (error) throw new Error(`city condo fetch failed: ${error.message}`);
    out.push(...((data ?? []) as unknown as Joined[]).map(flatten));
  }
  return out;
}

// No plain (array-of-objects) exported cache wrapper here on purpose —
// Bangkok's SELECT_LEAN payload can still flirt with the 2MB ceiling as
// objects (see warnIfNearCacheCeiling below), and an uncompacted alternative
// sitting next to the compact one is exactly the kind of unused-but-tempting
// export finding 7 flagged: the next caller who reaches for "the simple
// version" silently reintroduces the same never-caches bug. Only the compact
// form is exported; callers `decodeCompact()` it back to CondoSummary[].
//
// Compact (columnar) variant of the city feed. Same rows as
// _fetchCondoSummariesByCity above, but encoded struct-of-arrays so the serialised
// payload drops under Next's 2MB unstable_cache ceiling (the array-of-objects
// form spent ~1.1MB on repeated key names alone). Caching it means even
// Bangkok's cold requests are memoised instead of re-running a ~4.5s Supabase
// fetch. Both the inventory page (server) and /api/condos/inventory (client
// lazy-fetch) consume this; callers `decodeCompact()` it back to CondoSummary[].
async function _fetchCondoSummariesCompactByCity(
  citySlug: string
): Promise<CompactCondoSummaries> {
  const compact = encodeCompact(await _fetchCondoSummariesByCity(citySlug));
  warnIfNearCacheCeiling(`condos:by-city-compact(${citySlug})`, compact);
  return compact;
}

export const fetchCondoSummariesCompactByCity = unstable_cache(
  _fetchCondoSummariesCompactByCity,
  ["condos:by-city-compact"],
  { revalidate: 86400, tags: ["condos"] }
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
      .order("id")
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
  { revalidate: 86400, tags: ["condos"] }
);

// ---------------------------------------------------------------------------
// Home page feeds
// ---------------------------------------------------------------------------
// The home page also called fetchAllCondos() (~6.4MB) just to (a) plot map dots
// + count buildings per khet and (b) pick 9 featured cards. The hero-image URLs
// across all ~14k rows are what blow the 2MB cache ceiling. These two helpers
// split that:
//   - fetchCondoMapPoints: lean per-condo rows (id/name/lat/lng/region, no hero,
//     no url) for the choropleth + dot layer + khet counts. Comfortably caches.
//   - fetchHomeFeatured: pull only candidate IDs from the scoring tables, then
//     fetch those few full cards. Tiny, and avoids PostgREST embedded-filter
//     gymnastics.

// No `id` here on purpose. It was a 36-char UUID per row and, at ~15k rows,
// roughly 430KB of a payload that the log below shows sitting at 1.96MB
// against Next's hard 2MB unstable_cache ceiling — publishing Greater
// Bangkok (519 buildings, 2026-08-18) is what took it from 1.89 to 1.96.
// Crossing it does not error; caching just silently stops, and every home
// page render re-runs the whole condos_published scan. The id was only ever
// used as a React key and as an href fallback for rows with no slug, and
// those rows cannot be linked usefully anyway (/condo/<uuid> is a 308 to the
// slug URL), so they are skipped instead.
export type CondoMapPoint = {
  slug: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
};

async function _fetchCondoMapPoints(): Promise<CondoMapPoint[]> {
  const supabase = getServerSupabase();
  const out: CondoMapPoint[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("condos_published")
      .select("slug, name, latitude, longitude, regions(name)")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`map points fetch failed: ${error.message}`);
    const rows = (data ?? []) as Array<{
      slug: string | null;
      name: string;
      latitude: number | null;
      longitude: number | null;
      regions: { name: string } | { name: string }[] | null;
    }>;
    for (const r of rows) {
      if (!r.slug) continue; // unlinkable — see CondoMapPoint's note
      const reg = Array.isArray(r.regions) ? r.regions[0] : r.regions;
      out.push({
        slug: r.slug,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        region: reg?.name ?? null,
      });
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

// Struct-of-arrays encoding of the same points, same rationale as
// lib/condo-compact.ts's CompactCondoSummaries: an array-of-objects payload
// spends real bytes on the same 6 key names repeated once per row. The
// catalog has grown past the size that used to fit under Next's 2MB
// unstable_cache ceiling as-objects (confirmed in production logs 2026-07-24:
// "items over 2MB can not be cached (2451098 bytes)"), which meant this feed
// silently stopped caching and every single home-page hit re-ran the full
// condos_published scan. Columnar encoding drops the per-row key overhead
// the same way it did for the city inventory feed.
type CompactMapPoints = {
  v: 2;
  count: number;
  slug: string[];
  name: string[];
  lat: (number | null)[];
  lng: (number | null)[];
  region: (string | null)[];
};

function encodeMapPoints(rows: CondoMapPoint[]): CompactMapPoints {
  const n = rows.length;
  const c: CompactMapPoints = {
    v: 2,
    count: n,
    slug: new Array(n),
    name: new Array(n),
    lat: new Array(n),
    lng: new Array(n),
    region: new Array(n),
  };
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    c.slug[i] = r.slug;
    c.name[i] = r.name;
    c.lat[i] = r.latitude;
    c.lng[i] = r.longitude;
    c.region[i] = r.region;
  }
  return c;
}

function decodeMapPoints(c: CompactMapPoints): CondoMapPoint[] {
  const out: CondoMapPoint[] = new Array(c.count);
  for (let i = 0; i < c.count; i++) {
    out[i] = {
      slug: c.slug[i],
      name: c.name[i],
      latitude: c.lat[i],
      longitude: c.lng[i],
      region: c.region[i],
    };
  }
  return out;
}

async function _fetchCondoMapPointsCompact(): Promise<CompactMapPoints> {
  const compact = encodeMapPoints(await _fetchCondoMapPoints());
  warnIfNearCacheCeiling("condos:map-points-compact-v2", compact);
  return compact;
}

const fetchCondoMapPointsCompactCached = unstable_cache(
  _fetchCondoMapPointsCompact,
  ["condos:map-points-compact-v2"],
  { revalidate: 86400, tags: ["condos"] }
);

export async function fetchCondoMapPoints(): Promise<CondoMapPoint[]> {
  return decodeMapPoints(await fetchCondoMapPointsCompactCached());
}

export type HomeFeatured = {
  superValue: CondoSummary[];
  overpriced: CondoSummary[];
  safest: CondoSummary[];
};

async function _fetchHomeFeatured(): Promise<HomeFeatured> {
  const supabase = getServerSupabase();

  // Candidate IDs from the scoring/risk tables (cheap — id + one number).
  // Over-fetch overpriced/safest candidates so we still net 3 after the
  // hero-image filter that the cards want.
  const [svRes, opRes, safeRes] = await Promise.all([
    supabase
      .from("value_scores")
      .select("condo_id")
      .eq("is_super_value", true)
      .limit(24),
    supabase
      .from("value_scores")
      .select("condo_id, bubble_index")
      .not("bubble_index", "is", null)
      .order("bubble_index", { ascending: false })
      .limit(60),
    supabase
      .from("risk_factors")
      .select("condo_id, flood_risk_level")
      .lte("flood_risk_level", 1)
      .limit(60),
  ]);
  if (svRes.error) throw new Error(`super-value ids: ${svRes.error.message}`);
  if (opRes.error) throw new Error(`overpriced ids: ${opRes.error.message}`);
  if (safeRes.error) throw new Error(`safest ids: ${safeRes.error.message}`);

  const svIds = (svRes.data ?? []).map((r) => r.condo_id as string);
  const opIds = (opRes.data ?? []).map((r) => r.condo_id as string);
  const safeIds = (safeRes.data ?? []).map((r) => r.condo_id as string);

  const allIds = [...new Set([...svIds, ...opIds, ...safeIds])];
  if (allIds.length === 0) {
    return { superValue: [], overpriced: [], safest: [] };
  }

  // Fetch the (few) candidate cards in one round-trip, then build a lookup.
  const byId = new Map<string, CondoSummary>();
  for (let i = 0; i < allIds.length; i += PAGE) {
    const slice = allIds.slice(i, i + PAGE);
    const { data, error } = await supabase
      .from("condos_published")
      .select(SELECT)
      .in("id", slice);
    if (error) throw new Error(`featured cards fetch failed: ${error.message}`);
    for (const row of (data ?? []) as unknown as Joined[]) {
      const c = flatten(row);
      byId.set(c.id, c);
    }
  }

  const pick = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((c): c is CondoSummary => !!c);

  const superValue = pick(svIds).slice(0, 3);
  // opIds already arrive sorted by bubble_index desc; keep that order, require a
  // hero image (matches the previous home behaviour), take the top 3.
  const overpriced = pick(opIds)
    .filter((c) => c.hero_image_url)
    .slice(0, 3);
  const safest = pick(safeIds)
    .filter((c) => c.hero_image_url)
    .slice(0, 3);

  return { superValue, overpriced, safest };
}

export const fetchHomeFeatured = unstable_cache(
  _fetchHomeFeatured,
  ["home:featured"],
  { revalidate: 86400, tags: ["condos"] }
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
  { revalidate: 86400, tags: ["stats"] }
);
