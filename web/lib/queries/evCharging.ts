import { unstable_cache } from "next/cache";
import { canonicalCitySlug } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";

/**
 * Condos whose project page states charging stations are on site.
 *
 * condo_parking_facts holds 1,563 readings of "Charging stations on site",
 * and only 31 say yes (2026-10-04). That 2% is the point of the page: a
 * charger is the exception, so the list is short and worth publishing, while
 * a per-area directory of EV condos would be mostly empty pages — the
 * mistake that cost this site its traffic in July.
 */
export const EV_FACT_KEY = "Charging stations on site";

export type EvCondo = {
  slug: string;
  name: string;
  city: string;
  sale: number | null;
};

export type EvSummary = { checked: number; condos: EvCondo[] };

export const getEvChargingCondos = unstable_cache(
  async (): Promise<EvSummary> => {
    const supabase = getServerSupabase();
    const facts: Array<{ condo_id: string; fact_value: string | null }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("condo_parking_facts")
        .select("condo_id, fact_value")
        .eq("fact_key", EV_FACT_KEY)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`ev charging: ${error.message}`);
      facts.push(...((data ?? []) as typeof facts));
      if (!data || data.length < 1000) break;
    }

    const yes = facts
      .filter((f) => (f.fact_value ?? "").trim().toLowerCase() === "yes")
      .map((f) => f.condo_id);
    if (yes.length === 0) return { checked: facts.length, condos: [] };

    const condos: EvCondo[] = [];
    for (let i = 0; i < yes.length; i += 200) {
      const { data } = await supabase
        .from("condos_published")
        .select("slug, name, province, avg_sale_price")
        .in("id", yes.slice(i, i + 200))
        .not("slug", "is", null);
      for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
        condos.push({
          slug: r.slug as string,
          name: r.name as string,
          city: canonicalCitySlug(r.province as string | null),
          sale: (r.avg_sale_price as number) ?? null,
        });
      }
    }
    condos.sort((a, b) => (b.sale ?? 0) - (a.sale ?? 0) || a.name.localeCompare(b.name));
    return { checked: facts.length, condos };
  },
  ["ev-charging-condos-v1"],
  { revalidate: 604800 },
);
