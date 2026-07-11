// Shared, CLIENT-SAFE definitions for the /compare page, its client explorer
// and the /api/condos/compare route. No supabase / server imports here — the
// explorer component bundles this file.

export type CondoFull = {
  id: string;
  slug: string | null;
  name: string;
  url: string | null;
  province: string | null;
  completion_year: number | null;
  total_units: number | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  market_sale_median: number | null;
  market_rent_median: number | null;
  cam_fee_per_month: number | null;
  sinking_fund: number | null;
  building_ownership: string | null;
  aqi_score: number | null;
  pm25_value: number | null;
  foreign_quota_inventory_pct: number | null;
  regions: { name: string } | { name: string }[] | null;
};

export function regionName(r: CondoFull): string {
  const rg = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  return rg?.name ?? (r.province ?? "—").replace(/-/g, " ");
}

// JSON-transportable shape returned by /api/condos/compare — Maps aren't
// JSON-serializable, so scores/risks/liv travel as plain id-keyed objects.
export type CompareData = {
  condos: CondoFull[];
  scores: Record<string, number>;
  risks: Record<string, number>;
  liv: Record<string, number | null>;
  mrr: number | null;
};

/** Parse up to 3 condo ids off a/b/c query params (shared by page + route). */
export function parseCompareIds(getParam: (key: string) => string | null): string[] {
  return [getParam("a"), getParam("b"), getParam("c")]
    .filter((v): v is string => !!v && v.length > 8)
    .slice(0, 3);
}
