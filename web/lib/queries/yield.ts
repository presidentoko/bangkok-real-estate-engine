/**
 * Yield + MRR-spread helpers for condo pages.
 *
 * The condos_published view was created before yield columns existed —
 * Postgres pins view column lists at create time, so we read yield fields
 * directly from `condos` to skip needing another migration on the user side.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function getCurrentMortgageRate(
  supabase: SupabaseClient,
): Promise<MortgageRate | null> {
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
}

export function computeSpread(
  yieldPct: number | null,
  mortgageRate: number | null,
): number | null {
  if (yieldPct == null || mortgageRate == null) return null;
  return yieldPct - mortgageRate;
}
