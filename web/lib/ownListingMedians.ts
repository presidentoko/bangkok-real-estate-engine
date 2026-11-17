/**
 * A building's own sale / rent medians, from its own active listings.
 *
 * The condo <title> and the "Market signals" block used to print hipflat's
 * market_* summary columns as if they were this building's numbers. They are
 * not: for The Station Sathorn the title said $5,577/sqm and the block a
 * USD 632,671 median sale while the building's own 14 listings sat at USD
 * 59-86k and ~$2,165/m2 (data audit 2026-11-17, H9). Those columns are an
 * area-level or mismatched summary. The page now prints these medians when
 * there are at least MIN_OWN_LISTINGS, and labels the hipflat figure as an
 * area figure otherwise.
 *
 * Rows are filtered with the same plausibility gate as the yield and bubble
 * scripts: 15-300 m2, and USD amounts that are really baht dropped. Medians
 * are taken in one currency only (whichever most rows use).
 */
export const MIN_OWN_LISTINGS = 3;

export type OwnListingRow = {
  listing_type: string | null;
  price: number | string | null;
  price_per_sqm?: number | string | null;
  currency: string | null;
  area_sqm?: number | string | null;
  is_active?: boolean | null;
};

export type OwnMedian = { currency: "THB" | "USD"; median: number; perSqm: number | null; n: number };

function med(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function plausible(r: OwnListingRow, type: "sale" | "rent"): boolean {
  const price = Number(r.price);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (r.area_sqm != null) {
    const a = Number(r.area_sqm);
    if (!(a >= 15 && a <= 300)) return false;
  }
  const cur = (r.currency ?? "").toUpperCase();
  if (cur === "USD") return type === "rent" ? price >= 100 && price < 5_000 : price >= 10_000;
  if (cur === "THB") return type === "rent" ? price >= 1_000 : price >= 300_000;
  return false;
}

export function ownMedian(rows: OwnListingRow[], type: "sale" | "rent"): OwnMedian | null {
  const usable = rows.filter((r) => r.is_active !== false && r.listing_type === type && plausible(r, type));
  const byCur = new Map<string, OwnListingRow[]>();
  for (const r of usable) {
    const c = (r.currency ?? "").toUpperCase();
    byCur.set(c, [...(byCur.get(c) ?? []), r]);
  }
  const best = [...byCur.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!best || best[1].length < MIN_OWN_LISTINGS) return null;
  const [currency, rs] = best;
  const median = med(rs.map((r) => Number(r.price)));
  if (median == null) return null;
  const pps = rs
    .map((r) => (r.price_per_sqm != null ? Number(r.price_per_sqm) : r.area_sqm ? Number(r.price) / Number(r.area_sqm) : NaN))
    .filter((v) => Number.isFinite(v) && v > 0);
  return {
    currency: currency as "THB" | "USD",
    median,
    perSqm: pps.length >= MIN_OWN_LISTINGS ? med(pps) : null,
    n: rs.length,
  };
}

/** "$2,165" / "฿72,000" */
export function fmtOwnMoney(v: number, currency: "THB" | "USD"): string {
  return `${currency === "USD" ? "$" : "฿"}${Math.round(v).toLocaleString("en-US")}`;
}
