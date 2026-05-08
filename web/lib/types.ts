export type Condo = {
  id: string;
  name: string;
  developer: string | null;
  url: string | null;
  regions?: { name: string } | null;
};

export type ValueScore = {
  condo_id: string;
  bubble_index: number | null;
  asset_value_score: number | null;
  livability_rank_pct: number | null;
  asset_rank_pct: number | null;
  is_super_value: boolean;
};

export type Livability = {
  nearest_bts_distance_m: number | null;
  nearest_bts_station: string | null;
  nearest_mrt_distance_m: number | null;
  nearest_mrt_station: string | null;
  hospitals_within_1km: number;
  schools_within_1km: number;
  supermarkets_within_1km: number;
  livability_score: number | null;
};

export type Risk = {
  flood_risk_level: number | null;
  flood_risk_source: string | null;
  active_construction_within_500m: boolean;
  construction_count: number;
  risk_penalty: number | null;
};

export type LatestListing = {
  price: number;
  area_sqm: number | null;
  price_per_sqm: number | null;
};
