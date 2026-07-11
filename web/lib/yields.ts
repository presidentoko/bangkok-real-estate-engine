// Shared, CLIENT-SAFE definitions for the /yields ranking page, its client
// explorer and the /api/yields route. No supabase / server imports here —
// the explorer component bundles this file.

export const YIELD_PROVINCES = [
  { slug: "all",         label: "All Thailand" },
  { slug: "bangkok",     label: "Bangkok" },
  { slug: "phuket",      label: "Phuket" },
  { slug: "chon-buri",   label: "Chon Buri" },
  { slug: "chiang-mai",  label: "Chiang Mai" },
  { slug: "pattaya",     label: "Pattaya" },
] as const;

export const YIELD_SORT_OPTIONS = [
  { key: "yield",       column: "gross_yield_pct",   asc: false, label: "Highest yield"  },
  { key: "sale-asc",    column: "avg_sale_price",    asc: true,  label: "Cheapest sale"  },
  { key: "sale-desc",   column: "avg_sale_price",    asc: false, label: "Premium sale"   },
  { key: "rent-desc",   column: "avg_monthly_rent",  asc: false, label: "Highest rent"   },
  { key: "samples",     column: "yield_sample_sale", asc: false, label: "Most data"      },
] as const;

export type YieldSortOption = (typeof YIELD_SORT_OPTIONS)[number];

export const DEFAULT_MIN_YIELD = 3;

/** Same sanity clamp the page always applied: 3 ≤ min_yield ≤ 15, default 3. */
export function clampMinYield(raw: string | null | undefined): number {
  const n = Number(raw);
  return Math.max(3, Math.min(15, Number.isFinite(n) ? n : DEFAULT_MIN_YIELD));
}

export function resolveYieldSort(key: string | null | undefined): YieldSortOption {
  return YIELD_SORT_OPTIONS.find((s) => s.key === key) ?? YIELD_SORT_OPTIONS[0];
}

export type YieldRow = {
  id: string;
  slug: string | null;
  name: string;
  url: string | null;
  province: string | null;
  gross_yield_pct: number;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  yield_sample_sale: number | null;
  yield_sample_rent: number | null;
  regions: { name: string } | { name: string }[] | null;
};

export function yieldRegionLabel(r: YieldRow): string {
  const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  if (region?.name) return region.name;
  return (r.province ?? "").replace(/-/g, " ") || "—";
}
