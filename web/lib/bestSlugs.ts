/**
 * Programmatic SEO landing slug definitions for /best/[city]/[slug].
 *
 * Each slug is a fixed predicate (price + yield bounds) chosen for
 * matched search intent: "condos under 5M in Bangkok", "best yield
 * Phuket condos", etc. Adding a slug here ships ~27 new URLs (9 cities
 * × 3 languages) — keep the set small and high-signal.
 */

export type BestCitySlug =
  | "bangkok"
  | "phuket"
  | "chon-buri"
  | "chiang-mai"
  | "pattaya"
  | "hua-hin"
  | "ko-samui"
  | "krabi"
  | "chiang-rai";

/** Province values as stored in `condos.province`. */
export const BEST_CITIES: Array<{
  slug: BestCitySlug;
  display: string;
}> = [
  { slug: "bangkok",     display: "Bangkok" },
  { slug: "phuket",      display: "Phuket" },
  { slug: "chon-buri",   display: "Chon Buri" },
  { slug: "chiang-mai",  display: "Chiang Mai" },
  { slug: "pattaya",     display: "Pattaya" },
  { slug: "hua-hin",     display: "Hua Hin" },
  { slug: "ko-samui",    display: "Koh Samui" },
  { slug: "krabi",       display: "Krabi" },
  { slug: "chiang-rai",  display: "Chiang Rai" },
];

export type BestFilterSlug =
  | "under-3m"
  | "under-5m"
  | "under-10m"
  | "under-20m"
  | "top-yield"
  | "under-5m-top-yield"
  | "under-10m-top-yield";

export type BestFilter = {
  slug: BestFilterSlug;
  /** Inclusive upper bound on avg_sale_price (THB). null = no cap. */
  maxSale: number | null;
  /** Inclusive lower bound on gross_yield_pct. null = no floor (but >=3). */
  minYield: number | null;
};

/** Title/H1/description copy for each filter lives in the three
 *  dictionaries under `best.filters[slug]`, not here: it was English
 *  closures on this object until 2026-08-31, which is why all 189
 *  /best/ URLs shipped an English <title> regardless of locale. This file
 *  keeps the predicate -- the price and yield bounds -- which is data and
 *  identical in every language. */

const TOP_YIELD_FLOOR = 5;

export const BEST_FILTERS: BestFilter[] = [
  {
    slug: "under-3m",
    maxSale: 3_000_000,
    minYield: null,
  },
  {
    slug: "under-5m",
    maxSale: 5_000_000,
    minYield: null,
  },
  {
    slug: "under-10m",
    maxSale: 10_000_000,
    minYield: null,
  },
  {
    slug: "under-20m",
    maxSale: 20_000_000,
    minYield: null,
  },
  {
    slug: "top-yield",
    maxSale: null,
    minYield: TOP_YIELD_FLOOR,
  },
  {
    slug: "under-5m-top-yield",
    maxSale: 5_000_000,
    minYield: TOP_YIELD_FLOOR,
  },
  {
    slug: "under-10m-top-yield",
    maxSale: 10_000_000,
    minYield: TOP_YIELD_FLOOR,
  },
];

export function getBestCity(slug: string): { slug: BestCitySlug; display: string } | null {
  return BEST_CITIES.find((c) => c.slug === slug) ?? null;
}

export function getBestFilter(slug: string): BestFilter | null {
  return BEST_FILTERS.find((f) => f.slug === slug) ?? null;
}

/**
 * Pretty currency-style label for a budget — used in cross-link UI.
 *   3_000_000 → "฿3M", 500_000 → "฿500K"
 */
export function fmtBudget(thb: number): string {
  if (thb >= 1_000_000) return `฿${(thb / 1_000_000).toFixed(0)}M`;
  if (thb >= 1_000) return `฿${(thb / 1_000).toFixed(0)}K`;
  return `฿${thb}`;
}
