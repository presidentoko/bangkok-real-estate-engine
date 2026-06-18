// web/lib/queries/stations.ts
import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { buildStationIndex, stationSlug, type StationIndex } from "@/lib/stations";
import type { CondoSummary } from "@/lib/queries/condos";

const RADIUS_M = 1000;
const MIN_CONDOS = 5;

type LivRow = {
  condo_id: string;
  nearest_bts_station: string | null;
  nearest_bts_distance_m: number | null;
  nearest_mrt_station: string | null;
  nearest_mrt_distance_m: number | null;
};

// condo_id -> [station name, best distance within radius]
type StationToCondos = Map<string, Map<string, number>>;

async function fetchAllLivability(): Promise<LivRow[]> {
  const sb = getServerSupabase();
  const out: LivRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("livability_metrics")
      .select(
        "condo_id,nearest_bts_station,nearest_bts_distance_m,nearest_mrt_station,nearest_mrt_distance_m",
      )
      .range(from, from + page - 1);
    if (error || !data) break;
    out.push(...(data as LivRow[]));
    if (data.length < page) break;
  }
  return out;
}

/** Build the station -> {condoId: minDist} map, unioning both columns. */
function indexStations(rows: LivRow[]): StationToCondos {
  const map: StationToCondos = new Map();
  for (const r of rows) {
    const pairs: Array<[string | null, number | null]> = [
      [r.nearest_bts_station, r.nearest_bts_distance_m],
      [r.nearest_mrt_station, r.nearest_mrt_distance_m],
    ];
    for (const [name, dist] of pairs) {
      if (!name || dist == null || dist > RADIUS_M) continue;
      if (!map.has(name)) map.set(name, new Map());
      const condos = map.get(name)!;
      const prev = condos.get(r.condo_id);
      if (prev == null || dist < prev) condos.set(r.condo_id, dist);
    }
  }
  return map;
}

export type ViableStation = {
  slug: string;
  name: string;
  condoCount: number;
};

/** Stations with >= MIN_CONDOS distinct condos within RADIUS_M. Cached 1h. */
export const getViableStations = unstable_cache(
  async (): Promise<ViableStation[]> => {
    const rows = await fetchAllLivability();
    const byStation = indexStations(rows);
    const idx: StationIndex = buildStationIndex([...byStation.keys()]);
    // Merge condo sets per slug (different spellings -> same slug).
    const bySlug = new Map<string, Set<string>>();
    for (const [name, condos] of byStation) {
      const slug = stationSlug(name);
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, new Set());
      const set = bySlug.get(slug)!;
      for (const id of condos.keys()) set.add(id);
    }
    const out: ViableStation[] = [];
    for (const [slug, condoIds] of bySlug) {
      if (condoIds.size < MIN_CONDOS) continue;
      out.push({ slug, name: idx.get(slug) ?? slug, condoCount: condoIds.size });
    }
    out.sort((a, b) => b.condoCount - a.condoCount);
    return out;
  },
  ["viable-stations-v1"],
  { revalidate: 3600 },
);

export type StationData = {
  name: string;
  slug: string;
  condos: CondoSummary[];
  medianPsm: number | null;
  medianYieldPct: number | null;
  avgFloodLevel: number | null;
};

const CONDO_SELECT =
  "id, name, url, latitude, longitude, hero_image_url, total_units, available_units_count, market_sale_median, market_rent_median, market_summary_currency, property_type, province, source, regions(name), value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

function median(xs: number[]): number | null {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function rowToSummary(r: Record<string, any>): CondoSummary {
  const region = Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name;
  const vs = Array.isArray(r.value_scores) ? r.value_scores[0] : r.value_scores;
  const rf = Array.isArray(r.risk_factors) ? r.risk_factors[0] : r.risk_factors;
  return {
    id: r.id,
    slug: r.slug ?? null,
    name: r.name,
    url: r.url ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    region: region ?? null,
    province: r.province,
    hero_image_url: r.hero_image_url ?? null,
    bubble_index: vs?.bubble_index ?? null,
    is_super_value: vs?.is_super_value ?? null,
    flood_risk_level: rf?.flood_risk_level ?? null,
    total_units: r.total_units ?? null,
    available_units_count: r.available_units_count ?? null,
    market_sale_median: r.market_sale_median ?? null,
    market_rent_median: r.market_rent_median ?? null,
    market_summary_currency: r.market_summary_currency ?? null,
    property_type: r.property_type,
    source: r.source,
  };
}

/** Full data for one station spoke. Returns null if slug is unknown/sub-threshold. */
export const getStationData = unstable_cache(
  async (slug: string): Promise<StationData | null> => {
    const rows = await fetchAllLivability();
    const byStation = indexStations(rows);
    const idx = buildStationIndex([...byStation.keys()]);
    const name = idx.get(slug);
    if (!name) return null;

    // condo ids within radius for any spelling that maps to this slug
    const condoIds = new Set<string>();
    for (const [stName, condos] of byStation) {
      if (stationSlug(stName) !== slug) continue;
      for (const id of condos.keys()) condoIds.add(id);
    }
    if (condoIds.size < MIN_CONDOS) return null;

    const sb = getServerSupabase();
    const ids = [...condoIds];
    const condoRows: Record<string, any>[] = [];
    const chunk = 200; // keep .in() filter URL length sane
    for (let i = 0; i < ids.length; i += chunk) {
      const { data } = await sb
        .from("condos_published")
        .select(CONDO_SELECT)
        .in("id", ids.slice(i, i + chunk));
      if (data) condoRows.push(...(data as Record<string, any>[]));
    }
    const condos = condoRows.map(rowToSummary);

    // gross yield per condo from the condos table (not in condos_published)
    const { data: yieldRows } = await sb
      .from("condos")
      .select("id, gross_yield_pct, market_sale_per_sqm")
      .in("id", ids);
    const yields = (yieldRows ?? [])
      .map((r: any) => r.gross_yield_pct)
      .filter((n: any): n is number => typeof n === "number");
    const psm = (yieldRows ?? [])
      .map((r: any) => r.market_sale_per_sqm)
      .filter((n: any): n is number => typeof n === "number");
    const floods = condos
      .map((c) => c.flood_risk_level)
      .filter((n): n is number => typeof n === "number");

    return {
      name,
      slug,
      condos: condos.sort((a, b) => (a.name > b.name ? 1 : -1)),
      medianPsm: median(psm),
      medianYieldPct: median(yields),
      avgFloodLevel: floods.length
        ? Math.round((floods.reduce((s, n) => s + n, 0) / floods.length) * 10) / 10
        : null,
    };
  },
  ["station-data-v1"],
  { revalidate: 3600 },
);
