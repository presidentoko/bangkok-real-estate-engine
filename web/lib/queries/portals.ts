export type Listing = {
  source: string;
  listing_type: string;
  price: number;
  currency: string | null;
  is_active: boolean;
};

export type PortalStat = {
  source: "hipflat" | "dotproperty" | "ddproperty" | "fazwaz";
  saleCount: number;
  rentCount: number;
  /** Both medians are normalised to THB so the cross-portal table can
   *  compare them without unit mismatch (FazWaz stores USD per unit
   *  while Hipflat/DDProperty/DotProperty store THB — failing to
   *  convert produced the ฿115K vs ฿24M apples-to-oranges bug). */
  saleMedian: number | null;
  rentMedian: number | null;
};

const SOURCES: PortalStat["source"][] = [
  "hipflat",
  "fazwaz",
  "dotproperty",
  "ddproperty",
];

// Rough THB FX. Refresh from a central FX source later if accuracy matters.
const FX_TO_THB: Record<string, number> = {
  THB: 1,
  USD: 36,
  EUR: 39,
  GBP: 46,
  SGD: 27,
  HKD: 4.6,
};

function toTHB(price: number, currency: string | null | undefined): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const fx = FX_TO_THB[(currency || "THB").toUpperCase()];
  // If we don't know the currency, treat it as already-THB rather than
  // dropping the row — every portal we ingest has SOMETHING in `price`.
  return price * (fx ?? 1);
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Takes rows already fetched by the caller (condo/[slug]/page.tsx fetches
// every listing for the condo once and derives both the hipflat units table
// and this cross-portal comparison from it, instead of two separate
// Supabase round trips against the same `listings` table).
export function computePortalStats(allRows: Listing[]): PortalStat[] {
  const rows = allRows.filter((r) => r.is_active && r.price != null);
  const out: PortalStat[] = SOURCES.map((src) => {
    const sale = rows
      .filter((r) => r.source === src && r.listing_type === "sale")
      .map((r) => toTHB(Number(r.price), r.currency))
      .filter((v): v is number => v != null);
    const rent = rows
      .filter((r) => r.source === src && r.listing_type === "rent")
      .map((r) => toTHB(Number(r.price), r.currency))
      .filter((v): v is number => v != null);
    return {
      source: src,
      saleCount: sale.length,
      rentCount: rent.length,
      saleMedian: median(sale),
      rentMedian: median(rent),
    };
  });
  return out;
}
