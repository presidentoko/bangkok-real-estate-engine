/**
 * Rental yield by area — the data behind /[lang]/yield/[city] and
 * /[lang]/yield/[city]/[district].
 *
 * Why these pages exist: Search Console (2026-09-15) shows people asking
 * "laguna phuket rental yield", "phuket condo roi", "คอนโดหัวหิน ผลตอบแทนสูง",
 * "average rental yield for a 2-bedroom luxury condo in sukhumvit" — and
 * nothing on the site answers "what does a condo in X yield". /yields is a
 * national ranking and /best is a shopping list. These pages lead with the
 * number for one area and show how it was measured.
 *
 * Pure and client-safe: no Supabase, no Next imports, so it runs under
 * `node --test`. lib/queries/yieldAreas.ts does the fetching.
 */
import { canonicalCitySlug } from "./cities.ts";

export type YieldAreaRow = {
  id: string;
  slug: string | null;
  name: string;
  province: string | null;
  region: string | null;
  gross_yield_pct: number;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
};

/** An area page needs this many measured buildings. Below it a median is
 *  one or two buildings' rent and says nothing about the area. 42 districts
 *  and 9 cities clear 8 (2026-09-15). */
export const MIN_AREA_CONDOS = 8;

/** A price band's median is printed only with at least this many buildings. */
export const MIN_BAND_CONDOS = 3;

export const TOP_CONDOS = 10;

export const PRICE_BANDS = [
  { key: "under3m", max: 3_000_000 },
  { key: "3to5m", max: 5_000_000 },
  { key: "5to10m", max: 10_000_000 },
  { key: "over10m", max: Infinity },
] as const;

export type PriceBandKey = (typeof PRICE_BANDS)[number]["key"];

/** Which city page, and which district page (if any), a building counts on.
 *
 *  Two data quirks handled here rather than in every caller:
 *  - 143 buildings sit under province "chon-buri" with region "pattaya".
 *    That is Pattaya; counting them as a Chon Buri district would give
 *    Pattaya two yield pages with different numbers.
 *  - A region named after its own city ("hua-hin" in Hua Hin) would be a
 *    district page repeating the city page. */
export function areaKeys(r: Pick<YieldAreaRow, "province" | "region">): {
  city: string;
  district: string | null;
} {
  const region = r.region?.trim().toLowerCase() || null;
  const city = canonicalCitySlug(r.province);
  if (region === "pattaya") return { city: "pattaya", district: null };
  if (region && region.replace(/-/g, "") === city) return { city, district: null };
  return { city, district: region };
}

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function round2(n: number | null): number | null {
  return n == null ? null : Math.round(n * 100) / 100;
}

export type AreaStats = {
  count: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  medianSale: number | null;
  medianRent: number | null;
  bands: Array<{ key: PriceBandKey; count: number; median: number | null }>;
  top: YieldAreaRow[];
};

export function computeAreaStats(rows: YieldAreaRow[]): AreaStats {
  const yields = rows.map((r) => r.gross_yield_pct).sort((a, b) => a - b);
  const sales = rows
    .map((r) => r.avg_sale_price)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
  const rents = rows
    .map((r) => r.avg_monthly_rent)
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);

  let lower = 0;
  const bands = PRICE_BANDS.map((b) => {
    const inBand = rows
      .filter((r) => r.avg_sale_price != null && r.avg_sale_price >= lower && r.avg_sale_price < b.max)
      .map((r) => r.gross_yield_pct)
      .sort((a, c) => a - c);
    lower = b.max;
    return {
      key: b.key,
      count: inBand.length,
      median: inBand.length >= MIN_BAND_CONDOS ? round2(quantile(inBand, 0.5)) : null,
    };
  });

  return {
    count: rows.length,
    median: round2(quantile(yields, 0.5)),
    p25: round2(quantile(yields, 0.25)),
    p75: round2(quantile(yields, 0.75)),
    medianSale: quantile(sales, 0.5),
    medianRent: quantile(rents, 0.5),
    bands,
    top: [...rows]
      .filter((r) => r.slug)
      .sort((a, b) => b.gross_yield_pct - a.gross_yield_pct)
      .slice(0, TOP_CONDOS),
  };
}

export type YieldAreaIndex = {
  overall: AreaStats;
  cities: Array<{
    city: string;
    stats: AreaStats;
    districts: Array<{ district: string; stats: AreaStats }>;
  }>;
};

/** Cities and districts that clear `minCondos`, cities by measured count and
 *  districts by median yield (the order a reader comparing them wants). */
export function buildYieldAreaIndex(
  rows: YieldAreaRow[],
  minCondos: number = MIN_AREA_CONDOS,
): YieldAreaIndex {
  const byCity = new Map<string, { rows: YieldAreaRow[]; districts: Map<string, YieldAreaRow[]> }>();
  for (const r of rows) {
    const { city, district } = areaKeys(r);
    let c = byCity.get(city);
    if (!c) byCity.set(city, (c = { rows: [], districts: new Map() }));
    c.rows.push(r);
    if (district) {
      const d = c.districts.get(district) ?? [];
      d.push(r);
      c.districts.set(district, d);
    }
  }

  const cities = [...byCity.entries()]
    .filter(([, c]) => c.rows.length >= minCondos)
    .map(([city, c]) => ({
      city,
      stats: computeAreaStats(c.rows),
      districts: [...c.districts.entries()]
        .filter(([, d]) => d.length >= minCondos)
        .map(([district, d]) => ({ district, stats: computeAreaStats(d) }))
        .sort((a, b) => (b.stats.median ?? 0) - (a.stats.median ?? 0)),
    }))
    .sort((a, b) => b.stats.count - a.stats.count);

  return { overall: computeAreaStats(rows), cities };
}

export function findYieldArea(index: YieldAreaIndex, city: string, district?: string) {
  const c = index.cities.find((x) => x.city === city);
  if (!c) return null;
  if (!district) return { city: c, district: null };
  const d = c.districts.find((x) => x.district === district);
  return d ? { city: c, district: d } : null;
}
