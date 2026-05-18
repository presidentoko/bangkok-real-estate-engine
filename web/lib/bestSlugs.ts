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
  /** Display chunk used in titles + H1. */
  titleChunk: (cityDisplay: string) => string;
  /** Short description seed (~140 chars target). */
  descChunk: (cityDisplay: string) => string;
};

const TOP_YIELD_FLOOR = 5;

export const BEST_FILTERS: BestFilter[] = [
  {
    slug: "under-3m",
    maxSale: 3_000_000,
    minYield: null,
    titleChunk: (c) => `condos under ฿3M in ${c}`,
    descChunk: (c) =>
      `Every ${c} condo we measure with average sale price below ฿3,000,000 — ranked by gross rental yield against the Thai mortgage benchmark.`,
  },
  {
    slug: "under-5m",
    maxSale: 5_000_000,
    minYield: null,
    titleChunk: (c) => `condos under ฿5M in ${c}`,
    descChunk: (c) =>
      `${c} condos with average sale price under ฿5,000,000, ranked by yield and spread vs Thai MRR. Cross-portal verified pricing.`,
  },
  {
    slug: "under-10m",
    maxSale: 10_000_000,
    minYield: null,
    titleChunk: (c) => `condos under ฿10M in ${c}`,
    descChunk: (c) =>
      `Mid-tier ${c} condos under ฿10,000,000, yield-ranked. Every figure measured across hipflat, dotproperty, ddproperty, fazwaz.`,
  },
  {
    slug: "under-20m",
    maxSale: 20_000_000,
    minYield: null,
    titleChunk: (c) => `condos under ฿20M in ${c}`,
    descChunk: (c) =>
      `Premium ${c} condos under ฿20,000,000 with measured rental yields and foreign-quota inventory where available.`,
  },
  {
    slug: "top-yield",
    maxSale: null,
    minYield: TOP_YIELD_FLOOR,
    titleChunk: (c) => `top rental-yield condos in ${c}`,
    descChunk: (c) =>
      `${c} condos with measured gross rental yield ≥${TOP_YIELD_FLOOR}%. Pre-tax, pre-vacancy figures with at least 2 sale + 2 rent listings per building.`,
  },
  {
    slug: "under-5m-top-yield",
    maxSale: 5_000_000,
    minYield: TOP_YIELD_FLOOR,
    titleChunk: (c) => `best-yield condos under ฿5M in ${c}`,
    descChunk: (c) =>
      `${c} condos under ฿5,000,000 that hit ≥${TOP_YIELD_FLOOR}% gross rental yield — the entry-tier sweet spot for cashflow buyers.`,
  },
  {
    slug: "under-10m-top-yield",
    maxSale: 10_000_000,
    minYield: TOP_YIELD_FLOOR,
    titleChunk: (c) => `best-yield condos under ฿10M in ${c}`,
    descChunk: (c) =>
      `${c} condos under ฿10,000,000 with ≥${TOP_YIELD_FLOOR}% gross yield. Compare against the current Thai MRR mortgage rate.`,
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
