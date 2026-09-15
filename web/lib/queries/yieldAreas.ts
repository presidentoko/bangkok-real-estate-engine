import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { buildYieldAreaIndex, type YieldAreaIndex, type YieldAreaRow } from "@/lib/yieldAreas";

/**
 * Every building with a trustworthy yield, grouped into the area index.
 *
 * Same eligibility bar as /yields and /best (lib/queries/yield.ts
 * fetchYieldRows): at least 2 sale and 2 rent listings, yield above 0 and at
 * most 25%, sale price at least ฿500k, active and published. ~1,100 rows,
 * ~150KB, read once and shared by every area page, the sitemap and the
 * cross-links — cached for a week, which is the scrape cadence.
 */
export const getYieldAreaIndex = unstable_cache(
  async (): Promise<YieldAreaIndex> => {
    const supabase = getServerSupabase();
    const rows: YieldAreaRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("condos")
        .select("id, slug, name, province, gross_yield_pct, avg_sale_price, avg_monthly_rent, regions(name)")
        .gt("gross_yield_pct", 0)
        .lte("gross_yield_pct", 25)
        .gte("avg_sale_price", 500_000)
        .gte("yield_sample_sale", 2)
        .gte("yield_sample_rent", 2)
        .eq("is_active", true)
        .eq("published", true)
        .not("slug", "is", null)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`yield area index: ${error.message}`);
      type Raw = Omit<YieldAreaRow, "region"> & { regions: { name: string } | { name: string }[] | null };
      for (const r of (data ?? []) as unknown as Raw[]) {
        const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
        rows.push({
          id: r.id,
          slug: r.slug,
          name: r.name,
          province: r.province,
          region: region?.name ?? null,
          gross_yield_pct: Number(r.gross_yield_pct),
          avg_sale_price: r.avg_sale_price,
          avg_monthly_rent: r.avg_monthly_rent,
        });
      }
      if (!data || data.length < 1000) break;
    }
    return buildYieldAreaIndex(rows);
  },
  ["yield-area-index-v1"],
  { revalidate: 604800 },
);
