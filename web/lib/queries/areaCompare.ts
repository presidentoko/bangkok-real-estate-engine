import { unstable_cache } from "next/cache";
import { findFloodDistrict } from "@/lib/floodDistricts";
import { getStationData } from "@/lib/queries/stations";
import { getServerSupabase } from "@/lib/supabase";
import type { ComparePair } from "@/lib/comparePairs";

/**
 * One side of an /[lang]/vs/ comparison, measured the same way whether the
 * side is a BTS catchment or a district.
 */
export type CompareSide = {
  key: string;
  /** Buildings we track and can link to. */
  condos: number;
  medianYieldPct: number | null;
  /** Baht. avg_sale_price is what the yield pipeline computes, in THB. */
  medianSale: number | null;
  /** 0-5 BMA flood level; district sides outside Bangkok have none. */
  floodLevel: number | null;
  /** A few buildings to click through to. CondoSummary (what the station
   *  query returns) carries no per-condo yield, so the list shows the sale
   *  median, which both kinds of side have. */
  top: Array<{ slug: string; name: string; sale: number | null }>;
};

function median(xs: Array<number | null | undefined>): number | null {
  const v = xs.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

type DistrictRow = {
  slug: string | null;
  name: string;
  region: string | null;
  sale: number | null;
  yieldPct: number | null;
};

/** Every published building grouped by district, for the district pairs.
 *  One read a week, shared by every comparison page. */
const getDistrictIndex = unstable_cache(
  async (): Promise<Record<string, DistrictRow[]>> => {
    const supabase = getServerSupabase();
    const out: Record<string, DistrictRow[]> = {};
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("condos_published")
        .select("slug, name, avg_sale_price, gross_yield_pct, regions(name)")
        .not("slug", "is", null)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`district compare index: ${error.message}`);
      for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        const regions = r.regions as { name: string } | { name: string }[] | null;
        const region = (Array.isArray(regions) ? regions[0] : regions)?.name ?? null;
        if (!region) continue;
        (out[region] ??= []).push({
          slug: r.slug as string,
          name: r.name as string,
          region,
          sale: (r.avg_sale_price as number) ?? null,
          yieldPct: (r.gross_yield_pct as number) ?? null,
        });
      }
      if (!data || data.length < 1000) break;
    }
    return out;
  },
  ["district-compare-index-v1"],
  { revalidate: 604800 },
);

/** Enough buildings that a median means something, and enough that the two
 *  sides are comparable rather than anecdotal. */
export const MIN_COMPARE_CONDOS = 8;

async function districtSide(key: string): Promise<CompareSide | null> {
  const index = await getDistrictIndex();
  const rows = index[key] ?? [];
  if (rows.length < MIN_COMPARE_CONDOS) return null;
  return {
    key,
    condos: rows.length,
    medianYieldPct: median(rows.map((r) => r.yieldPct)),
    medianSale: median(rows.map((r) => r.sale)),
    floodLevel: findFloodDistrict(key)?.level ?? null,
    top: rows
      .filter((r) => r.slug && r.sale != null)
      .sort((a, b) => (b.sale ?? 0) - (a.sale ?? 0))
      .slice(0, 3)
      .map((r) => ({ slug: r.slug as string, name: r.name, sale: r.sale })),
  };
}

/** Per-building THB prices for one station catchment.
 *
 *  StationData carries CondoSummary, which has no THB sale price: its
 *  market_sale_median is the USD market-summary figure, and
 *  market_sale_per_sqm is a district-level number copied onto every building
 *  in it (240 distinct values across 1,000 rows), so neither can separate two
 *  adjacent stations. avg_sale_price is per building, in baht, and comes from
 *  the same listings the yields do. */
async function stationPrices(ids: string[]) {
  const supabase = getServerSupabase();
  const out: Array<{ slug: string | null; name: string; avg_sale_price: number | null; gross_yield_pct: number | null }> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("condos_published")
      .select("slug, name, avg_sale_price, gross_yield_pct")
      .in("id", ids.slice(i, i + 200));
    out.push(...((data ?? []) as unknown as typeof out));
  }
  return out;
}

async function stationSide(key: string): Promise<CompareSide | null> {
  const data = await getStationData(key);
  if (!data || data.condos.length < MIN_COMPARE_CONDOS) return null;
  const priced = await stationPrices(data.condos.map((c) => c.id));
  return {
    key,
    condos: data.condos.length,
    medianYieldPct: median(priced.map((c) => c.gross_yield_pct)),
    medianSale: median(priced.map((c) => c.avg_sale_price)),
    floodLevel: data.avgFloodLevel != null ? Math.round(data.avgFloodLevel) : null,
    top: priced
      .filter((c) => c.slug && c.avg_sale_price != null)
      .sort((a, b) => (b.avg_sale_price ?? 0) - (a.avg_sale_price ?? 0))
      .slice(0, 3)
      .map((c) => ({ slug: c.slug as string, name: c.name, sale: c.avg_sale_price })),
  };
}

/** Both sides, or null when either lacks the data to be compared. */
export async function getComparison(
  pair: ComparePair,
): Promise<{ a: CompareSide; b: CompareSide } | null> {
  const load = pair.kind === "station" ? stationSide : districtSide;
  const [a, b] = await Promise.all([load(pair.a), load(pair.b)]);
  return a && b ? { a, b } : null;
}
