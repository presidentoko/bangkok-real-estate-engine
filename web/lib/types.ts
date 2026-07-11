export type Condo = {
  id: string;
  name: string;
  developer: string | null;
  url: string | null;
  regions?: { name: string } | null;
  retiree_score?: number | null;
};

// Note: these three types are only consumed by ReportCard.tsx (and the
// condo/[slug] page's queries that feed it), so they're trimmed to exactly
// the columns those call sites select/read — not the full DB row shape.
export type ValueScore = {
  bubble_index: number | null;
  is_super_value: boolean | null;
  liquidity_score: number | null;
  liquidity_grade: string | null;
  liquidity_absorption_rate: number | null;
  liquidity_median_sold_dom: number | null;
  liquidity_sample_size: number | null;
};

export type Livability = {
  nearest_bts_distance_m: number | null;
  nearest_bts_station: string | null;
  nearest_mrt_distance_m: number | null;
  nearest_mrt_station: string | null;
  hospitals_within_1km: number;
  schools_within_1km: number;
  supermarkets_within_1km: number;
};

export type Risk = {
  flood_risk_level: number | null;
  subsidence_level: number | null;
  subsidence_source: string | null;
};

export type LatestListing = {
  price: number;
  area_sqm: number | null;
  price_per_sqm: number | null;
};
