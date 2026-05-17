import type { SupabaseClient } from "@supabase/supabase-js";

type Listing = {
  source: string;
  listing_type: string;
  price: number;
};

export type PortalStat = {
  source: "hipflat" | "dotproperty" | "ddproperty" | "fazwaz";
  saleCount: number;
  rentCount: number;
  saleMedian: number | null;
  rentMedian: number | null;
};

const SOURCES: PortalStat["source"][] = [
  "hipflat",
  "fazwaz",
  "dotproperty",
  "ddproperty",
];

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function getPortalStats(
  supabase: SupabaseClient,
  condoId: string,
): Promise<PortalStat[]> {
  const { data } = await supabase
    .from("listings")
    .select("source, listing_type, price")
    .eq("condo_id", condoId)
    .eq("is_active", true)
    .not("price", "is", null);

  const rows = (data ?? []) as Listing[];
  const out: PortalStat[] = SOURCES.map((src) => {
    const sale = rows.filter((r) => r.source === src && r.listing_type === "sale").map((r) => Number(r.price));
    const rent = rows.filter((r) => r.source === src && r.listing_type === "rent").map((r) => Number(r.price));
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
