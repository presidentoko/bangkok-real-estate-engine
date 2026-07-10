// Pure, server-computable helpers for the inventory page. Extracted out of the
// (client) InventoryGrid so the server component can compute the dashboard
// stats, top picks, district list and available type chips WITHOUT shipping the
// full city-scoped condo array to the browser. The grid then lazy-fetches the
// full set from /api/condos/inventory only when the user actually opens the
// grid (filters / search / "Show all").

import type { CondoSummary, PropertyType } from "@/lib/queries/condos";

export type InventoryStats = {
  currency: string;
  saleMedian: number | null;
  rentMedian: number | null;
  bubbleAvg: number | null;
  bubbleSampleSize: number;
  superValue: number;
  geoLocated: number;
};

export function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function computeInventoryStats(condos: CondoSummary[]): InventoryStats {
  const currency =
    condos.find((c) => c.market_summary_currency)?.market_summary_currency ?? "THB";
  const saleMedians = condos
    .map((c) => c.market_sale_median)
    .filter((x): x is number => typeof x === "number" && x > 0);
  const rentMedians = condos
    .map((c) => c.market_rent_median)
    .filter((x): x is number => typeof x === "number" && x > 0);
  const bubbles = condos
    .map((c) => c.bubble_index)
    .filter((x): x is number => typeof x === "number");
  return {
    currency,
    saleMedian: median(saleMedians),
    rentMedian: median(rentMedians),
    bubbleAvg: mean(bubbles),
    bubbleSampleSize: bubbles.length,
    superValue: condos.filter((c) => c.is_super_value).length,
    geoLocated: condos.filter((c) => c.latitude != null && c.longitude != null).length,
  };
}

// The canonical type order the UI renders chips in. The grid prepends "all".
export const PROPERTY_TYPE_ORDER: PropertyType[] = [
  "condo",
  "apartment",
  "serviced-apartment",
];

// Only the property types that actually exist in the dataset, in canonical order.
export function availablePropertyTypes(condos: CondoSummary[]): PropertyType[] {
  const set = new Set<PropertyType>();
  for (const c of condos) set.add(c.property_type);
  return PROPERTY_TYPE_ORDER.filter((t) => set.has(t));
}

// Featured cards shown in the default (un-filtered) state so the page isn't
// empty: super-value buildings with a photo, cheapest-bubble first.
export function topPicks(condos: CondoSummary[], limit = 6): CondoSummary[] {
  return [...condos]
    .filter((c) => c.is_super_value && c.hero_image_url)
    .sort((a, b) => (a.bubble_index ?? 100) - (b.bubble_index ?? 100))
    .slice(0, limit);
}

// Collapses case/whitespace/hyphen variants of a district name to a single
// comparison key (e.g. "Bang Khun Thian" and "bang-khun-thian" both map to
// "bangkhunthian"). Shared by extractDistricts (which builds the dropdown
// labels) and InventoryGrid (which filters against the selected label) so
// selecting a district matches every spelling variant, not just an exact
// string match.
export function normalizeDistrictLabel(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

// Distinct districts within a condo set, collapsing case/whitespace/hyphen
// variants and preferring a label that carries capitalisation.
export function extractDistricts(condos: CondoSummary[]): string[] {
  const labelByNorm = new Map<string, string>();
  for (const c of condos) {
    const r = c.region;
    if (!r) continue;
    const norm = normalizeDistrictLabel(r);
    const existing = labelByNorm.get(norm);
    if (!existing || (/[A-Z]/.test(r) && !/[A-Z]/.test(existing))) {
      labelByNorm.set(norm, r);
    }
  }
  return [...labelByNorm.values()].sort();
}
