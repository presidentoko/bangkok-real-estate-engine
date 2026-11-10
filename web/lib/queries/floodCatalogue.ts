import { unstable_cache } from "next/cache";
import { loadFloodLayer } from "@/lib/floodLayer.server";
import { getServerSupabase } from "@/lib/supabase";

/** The building population behind every Bangkok flood page: the hipflat
 *  catalogue (one record per building -- the other portals' rows are
 *  per-listing duplicates of the same towers), each assigned to one khet by
 *  loadFloodLayer().assign().
 *
 *  /flood and all 50 /flood/[district] pages read this one list, so a
 *  district page's count is by construction its row in the /flood table.
 *  Before 2026-11-10 the district pages counted every portal's rows by
 *  stored region_id instead (/flood/vadhana: 902 vs 69 on /flood).
 *
 *  Cached as one entry so the 150 district pages (50 khet x 3 locales) and
 *  the hub share a single Supabase read per week instead of 151. */
export type FloodCatalogueCondo = {
  id: string;
  slug: string | null;
  name: string;
  url: string | null;
  lat: number | null;
  lng: number | null;
  avg_sale_price: number | null;
  gross_yield_pct: number | null;
  /** FLOOD_DISTRICTS slug, or null if the building could not be placed. */
  district: string | null;
};

type Row = {
  id: string;
  slug: string | null;
  name: string;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  avg_sale_price: number | null;
  gross_yield_pct: number | null;
  regions: { name: string } | { name: string }[] | null;
};

const SELECT =
  "id, slug, name, url, latitude, longitude, avg_sale_price, gross_yield_pct, regions(name)";

async function load(): Promise<{ condos: FloodCatalogueCondo[]; latestSeen: string | null }> {
  const supabase = getServerSupabase();
  const layer = loadFloodLayer();
  const rows: Row[] = [];
  // PostgREST caps a response at 1000 rows; walk the table in pages.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("condos_published")
      .select(SELECT)
      .eq("source", "hipflat")
      .eq("province", "bangkok")
      .order("id", { ascending: true })
      .range(from, from + 999);
    // Throw rather than break: a silently short list publishes wrong
    // counts, and a thrown render keeps the last good ISR page.
    if (error) throw new Error(`flood catalogue: page ${from}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  // When the list was last refreshed: the newest last_seen_at. One row.
  const { data: seen } = await supabase
    .from("condos_published")
    .select("last_seen_at")
    .eq("source", "hipflat")
    .eq("province", "bangkok")
    .not("last_seen_at", "is", null)
    .order("last_seen_at", { ascending: false })
    .limit(1);

  const condos = rows.map((r) => {
    const rg = Array.isArray(r.regions) ? r.regions[0] : r.regions;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      url: r.url,
      lat: r.latitude,
      lng: r.longitude,
      avg_sale_price: r.avg_sale_price,
      gross_yield_pct: r.gross_yield_pct,
      district: layer.assign(r.latitude, r.longitude, rg?.name ?? null)?.slug ?? null,
    };
  });
  return {
    condos,
    latestSeen: ((seen?.[0] as { last_seen_at?: string } | undefined)?.last_seen_at) ?? null,
  };
}

export const getFloodCatalogue = unstable_cache(load, ["flood-catalogue-v1"], {
  revalidate: 604800,
  tags: ["flood-catalogue"],
});
