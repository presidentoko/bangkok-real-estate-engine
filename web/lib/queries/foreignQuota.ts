import { unstable_cache } from "next/cache";
import { canonicalCitySlug } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";

/**
 * Foreign-quota inventory across the buildings we track, for
 * /guide/foreign-quota.
 *
 * What the numbers are: scripts/ingest_foreign_quota.py counts the units
 * currently for sale on a building's FazWaz project page that are labelled
 * "Foreign Quota" vs "Thai Quota". That is a proxy for how much foreign
 * freehold is on the market, not the legal ratio the Land Office checks —
 * the page says so, and tells the reader how to get the legal figure.
 *
 * A building needs 5 labelled listings: with fewer, one listing moves the
 * share by 20+ points. 1,050 buildings clear that (2026-09-15).
 */
export const MIN_QUOTA_LISTINGS = 5;

export const QUOTA_CITIES = ["bangkok", "pattaya", "phuket", "huahin", "chiangmai"] as const;

/** Per-city distribution rather than a "most foreign-quota units" list: the
 *  FazWaz project page shows at most 30 units, so the top of any such list is
 *  a tie of 30/30 buildings and says nothing. */
export type QuotaCityStats = {
  city: (typeof QUOTA_CITIES)[number];
  buildings: number;
  plenty: number;
  tight: number;
  medianPct: number;
};

export type ForeignQuotaSummary = {
  buildings: number;
  plenty: number; // >= 60% of labelled listings are foreign quota
  tight: number; // < 10%
  fetchedMonth: string | null;
  byCity: QuotaCityStats[];
};

export const getForeignQuotaSummary = unstable_cache(
  async (): Promise<ForeignQuotaSummary> => {
    const supabase = getServerSupabase();
    type Raw = {
      province: string | null;
      foreign_quota_listings_available: number | null;
      total_quota_listings_observed: number | null;
      foreign_quota_inventory_pct: number | null;
      foreign_quota_fetched_at: string | null;
    };
    const rows: Raw[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("condos")
        .select(
          "province, foreign_quota_listings_available, " +
            "total_quota_listings_observed, foreign_quota_inventory_pct, foreign_quota_fetched_at",
        )
        .gte("total_quota_listings_observed", MIN_QUOTA_LISTINGS)
        .not("foreign_quota_inventory_pct", "is", null)
        .eq("published", true)
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`foreign quota summary: ${error.message}`);
      rows.push(...((data ?? []) as unknown as Raw[]));
      if (!data || data.length < 1000) break;
    }

    const latest = rows
      .map((r) => r.foreign_quota_fetched_at)
      .filter((d): d is string => !!d)
      .sort()
      .pop();

    const pctOf = (r: Raw) => Number(r.foreign_quota_inventory_pct);
    const byCity = QUOTA_CITIES.map((city) => {
      const inCity = rows.filter((r) => canonicalCitySlug(r.province) === city);
      const sorted = inCity.map(pctOf).sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      return {
        city,
        buildings: inCity.length,
        plenty: inCity.filter((r) => pctOf(r) >= 60).length,
        tight: inCity.filter((r) => pctOf(r) < 10).length,
        medianPct: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
      };
    }).filter((c) => c.buildings >= 10);

    return {
      buildings: rows.length,
      plenty: rows.filter((r) => Number(r.foreign_quota_inventory_pct) >= 60).length,
      tight: rows.filter((r) => Number(r.foreign_quota_inventory_pct) < 10).length,
      fetchedMonth: latest ? latest.slice(0, 7) : null,
      byCity,
    };
  },
  ["foreign-quota-summary-v2"],
  { revalidate: 604800 },
);
