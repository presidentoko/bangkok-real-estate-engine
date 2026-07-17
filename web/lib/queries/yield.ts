/**
 * Yield + MRR-spread helpers for condo pages.
 *
 * The condos_published view was created before yield columns existed —
 * Postgres pins view column lists at create time, so we read yield fields
 * directly from `condos` to skip needing another migration on the user side.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { canonicalCitySlug, cityProvinceSlugs } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";
import {
  clampMinYield,
  resolveYieldSort,
  type YieldRow,
} from "@/lib/yields";

const MRR_INDICATORS = [
  "MRR (Minimum Retail Rate) Min",
  "MRR (Minimum Retail Rate) Max",
] as const;

export type CondoYield = {
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  yield_sample_sale: number | null;
  yield_sample_rent: number | null;
  yield_computed_at: string | null;
};

export type MortgageRate = {
  rate: number;            // mean of MRR Min + Max
  period: string;          // YYYY-MM-DD (first of month)
  series: "FM_RT_001_S2";
};

export async function getCondoYield(
  supabase: SupabaseClient,
  condoId: string,
): Promise<CondoYield | null> {
  const { data } = await supabase
    .from("condos")
    .select(
      "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
      "yield_sample_sale, yield_sample_rent, yield_computed_at",
    )
    .eq("id", condoId)
    .maybeSingle();
  return (data as CondoYield | null) ?? null;
}

// The BOT MRR series updates at most monthly, and this same query previously
// ran once per condo/district/yields/compare page render (no dedup) — cached
// 7d like the other cross-page reference data on this site (getViableStations,
// getYieldByArea) since staleness only matters to the day, not the request.
export const getCurrentMortgageRate = unstable_cache(
  async (): Promise<MortgageRate | null> => {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from("macro_indicators")
      .select("indicator_name, value, period")
      .eq("source", "bot")
      .eq("series_code", "FM_RT_001_S2")
      .in("indicator_name", MRR_INDICATORS as unknown as string[])
      .order("period", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as Array<{
      indicator_name: string;
      value: number;
      period: string;
    }>;
    if (rows.length === 0) return null;
    const latest = rows[0].period;
    const same = rows.filter((r) => r.period === latest).map((r) => Number(r.value));
    if (same.length === 0) return null;
    return {
      rate: same.reduce((a, b) => a + b, 0) / same.length,
      period: latest,
      series: "FM_RT_001_S2",
    };
  },
  ["mortgage-rate-v1"],
  { revalidate: 604800 },
);

/**
 * Ranked yield rows for /yields and /api/yields. Same sanity bounds as
 * src/analysis/yield_digest.py — filter out obvious price-parse outliers
 * (yield > 25%, sale < ฿500k, fewer than 2 sale/rent samples).
 */
export async function fetchYieldRows(
  supabase: SupabaseClient,
  opts: {
    province?: string | null;
    sort?: string | null;
    minYield?: string | null;
  } = {},
): Promise<YieldRow[]> {
  const sortOpt = resolveYieldSort(opts.sort);
  const minYield = clampMinYield(opts.minYield);

  let query = supabase
    .from("condos")
    .select(
      "id, slug, name, url, province, " +
      "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
      "yield_sample_sale, yield_sample_rent, regions(name)",
    )
    .gte("gross_yield_pct", minYield)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2)
    .eq("is_active", true)
    .order(sortOpt.column, { ascending: sortOpt.asc })
    .limit(100);

  if (opts.province && opts.province !== "all") {
    // DB `province` has two slug conventions (e.g. "chonburi" and
    // "chon-buri"); match every alias for the selected city, not just the
    // exact string the chip links to.
    query = query.in("province", cityProvinceSlugs(canonicalCitySlug(opts.province)));
  }

  const { data } = await query;
  return (data ?? []) as unknown as YieldRow[];
}

export function computeSpread(
  yieldPct: number | null,
  mortgageRate: number | null,
): number | null {
  if (yieldPct == null || mortgageRate == null) return null;
  return yieldPct - mortgageRate;
}
