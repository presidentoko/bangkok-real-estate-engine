// Server-safe query for the /compare page and /api/condos/compare route.
// Reused by both so the static page shell and the client-fetch route share
// one implementation (same pattern as lib/queries/yield.ts's fetchYieldRows).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CondoFull } from "@/lib/compare";

export type CompareResult = {
  condos: CondoFull[];
  scores: Map<string, number>;
  risks: Map<string, number>;
  liv: Map<string, number | null>;
};

export async function fetchCompareCondos(
  supabase: SupabaseClient,
  ids: string[],
): Promise<CompareResult> {
  if (ids.length === 0) {
    return { condos: [], scores: new Map(), risks: new Map(), liv: new Map() };
  }
  const [{ data: condoData }, { data: scoreData }, { data: riskData }, { data: livData }] = await Promise.all([
    supabase
      .from("condos")
      .select(
        "id, slug, name, url, province, completion_year, total_units, " +
        "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
        "market_sale_median, market_rent_median, " +
        "cam_fee_per_month, sinking_fund, building_ownership, " +
        "aqi_score, pm25_value, foreign_quota_inventory_pct, " +
        "regions(name)"
      )
      .in("id", ids),
    supabase.from("value_scores").select("condo_id, bubble_index").in("condo_id", ids),
    supabase.from("risk_factors").select("condo_id, flood_risk_level").in("condo_id", ids),
    supabase.from("livability_metrics").select("condo_id, nearest_bts_distance_m").in("condo_id", ids),
  ]);
  const scores = new Map<string, number>();
  for (const s of (scoreData ?? []) as Array<{ condo_id: string; bubble_index: number | null }>) {
    if (s.bubble_index != null) scores.set(s.condo_id, Number(s.bubble_index));
  }
  const risks = new Map<string, number>();
  for (const r of (riskData ?? []) as Array<{ condo_id: string; flood_risk_level: number | null }>) {
    if (r.flood_risk_level != null) risks.set(r.condo_id, r.flood_risk_level);
  }
  const liv = new Map<string, number | null>();
  for (const l of (livData ?? []) as Array<{ condo_id: string; nearest_bts_distance_m: number | null }>) {
    liv.set(l.condo_id, l.nearest_bts_distance_m);
  }
  const condos = (condoData ?? []) as unknown as CondoFull[];
  // Preserve input order
  const ordered = ids
    .map((id) => condos.find((c) => c.id === id))
    .filter((c): c is CondoFull => !!c);
  return { condos: ordered, scores, risks, liv };
}
