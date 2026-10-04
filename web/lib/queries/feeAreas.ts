import { unstable_cache } from "next/cache";
import { CAM_FEE_MAX, CAM_FEE_MIN } from "@/lib/camFee";
import { canonicalCitySlug } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";

/**
 * Common-area (CAM) fees by area — the data behind /[lang]/fees/[city].
 *
 * "ค่าส่วนกลาง เท่าไร" is one of the questions Thai buyers ask that the
 * portals answer per listing and nobody answers per area. We hold a monthly
 * fee for 2,896 buildings, which is enough to publish a median for 8 cities
 * and 47 districts.
 *
 * The value is the fee for one unit in the building, not a per-sqm rate, so
 * a median moves with the unit mix as well as the building. The page says so.
 */
export const MIN_FEE_CONDOS = 8;

export type FeeStats = {
  count: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  medianSink: number | null;
};

export type FeeAreaIndex = {
  overall: FeeStats;
  cities: Array<{
    city: string;
    stats: FeeStats;
    districts: Array<{ district: string; stats: FeeStats }>;
  }>;
};

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

function stats(rows: Array<{ cam: number; sink: number | null }>): FeeStats {
  const cam = rows.map((r) => r.cam).sort((a, b) => a - b);
  const sink = rows
    .map((r) => r.sink)
    .filter((n): n is number => n != null && n > 0)
    .sort((a, b) => a - b);
  return {
    count: rows.length,
    median: quantile(cam, 0.5),
    p25: quantile(cam, 0.25),
    p75: quantile(cam, 0.75),
    medianSink: sink.length >= 5 ? quantile(sink, 0.5) : null,
  };
}

export const getFeeAreaIndex = unstable_cache(
  async (): Promise<FeeAreaIndex> => {
    const supabase = getServerSupabase();
    type Raw = {
      province: string | null;
      cam_fee_per_month: number | null;
      sinking_fund: number | null;
      regions: { name: string } | { name: string }[] | null;
    };
    const rows: Array<{ city: string; district: string | null; cam: number; sink: number | null }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("condos_published")
        .select("province, cam_fee_per_month, sinking_fund, regions(name)")
        .gte("cam_fee_per_month", CAM_FEE_MIN)
        .lte("cam_fee_per_month", CAM_FEE_MAX)
        .not("slug", "is", null)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`fee area index: ${error.message}`);
      for (const r of (data ?? []) as unknown as Raw[]) {
        const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
        rows.push({
          city: canonicalCitySlug(r.province),
          district: region?.name ?? null,
          cam: Number(r.cam_fee_per_month),
          sink: r.sinking_fund != null ? Number(r.sinking_fund) : null,
        });
      }
      if (!data || data.length < 1000) break;
    }

    const byCity = new Map<string, { rows: typeof rows; districts: Map<string, typeof rows> }>();
    for (const r of rows) {
      let c = byCity.get(r.city);
      if (!c) byCity.set(r.city, (c = { rows: [], districts: new Map() }));
      c.rows.push(r);
      if (r.district) {
        const d = c.districts.get(r.district) ?? [];
        d.push(r);
        c.districts.set(r.district, d);
      }
    }

    const cities = [...byCity.entries()]
      .filter(([, c]) => c.rows.length >= MIN_FEE_CONDOS)
      .map(([city, c]) => ({
        city,
        stats: stats(c.rows),
        districts: [...c.districts.entries()]
          .filter(([, d]) => d.length >= MIN_FEE_CONDOS)
          .map(([district, d]) => ({ district, stats: stats(d) }))
          .sort((a, b) => (b.stats.median ?? 0) - (a.stats.median ?? 0)),
      }))
      .sort((a, b) => b.stats.count - a.stats.count);

    return { overall: stats(rows), cities };
  },
  ["fee-area-index-v1"],
  { revalidate: 604800 },
);

export function findFeeCity(index: FeeAreaIndex, city: string) {
  return index.cities.find((c) => c.city === city) ?? null;
}
