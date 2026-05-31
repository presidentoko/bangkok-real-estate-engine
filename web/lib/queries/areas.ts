// web/lib/queries/areas.ts
import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";

export type AreaYield = {
  area: string;
  condoCount: number;
  medianYieldPct: number | null;
  medianPsm: number | null;
};

function median(xs: number[]): number | null {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Median gross yield + price/sqm grouped by region name, Bangkok only. Cached 1h. */
export const getYieldByArea = unstable_cache(
  async (minCondos = 5, limit = 25): Promise<AreaYield[]> => {
    const sb = getServerSupabase();
    const rows: Array<{ gross_yield_pct: number | null; market_sale_per_sqm: number | null; region_name: string | null }> = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb
        .from("condos")
        .select("gross_yield_pct, market_sale_per_sqm, region_name, province")
        .eq("province", "bangkok")
        .range(from, from + page - 1);
      if (error || !data) break;
      rows.push(...(data as any[]));
      if (data.length < page) break;
    }
    const byArea = new Map<string, { y: number[]; p: number[] }>();
    for (const r of rows) {
      const a = r.region_name?.trim();
      if (!a) continue;
      if (!byArea.has(a)) byArea.set(a, { y: [], p: [] });
      const e = byArea.get(a)!;
      if (typeof r.gross_yield_pct === "number") e.y.push(r.gross_yield_pct);
      if (typeof r.market_sale_per_sqm === "number") e.p.push(r.market_sale_per_sqm);
    }
    const out: AreaYield[] = [];
    for (const [area, e] of byArea) {
      const count = Math.max(e.y.length, e.p.length);
      if (count < minCondos) continue;
      out.push({ area, condoCount: count, medianYieldPct: median(e.y), medianPsm: median(e.p) });
    }
    out.sort((a, b) => (b.medianYieldPct ?? 0) - (a.medianYieldPct ?? 0));
    return out.slice(0, limit);
  },
  ["yield-by-area-v1"],
  { revalidate: 3600 },
);
