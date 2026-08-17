import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";

/**
 * hipflat "nearby project" name -> our own condo slug.
 *
 * The condo_neighbours rows come from hipflat's own nearby-projects block,
 * and its slugs carry a per-project hash suffix (`the-estate-at-thapra-
 * qwdtqd`) that will never match ours. The display name does: 10,994 of
 * 18,879 neighbour rows (58%) name a building we already have a page for,
 * spread over just 475 distinct names.
 *
 * Resolved once and cached, not once per page. The first version of this
 * did the `.in("name", ...)` lookup inside condo/[slug]/page.tsx, which
 * meant one extra Supabase round trip for every one of the ~900 prebuilt
 * condo pages — the build went from ~13 minutes to over 35 and came close
 * to the platform's build timeout. Both source tables change only on the
 * weekly refresh, so a 7-day cache costs two reads a week and the page
 * body gets a plain object lookup.
 *
 * The returned map is small (~475 entries) because it is keyed by the
 * matched names only — deliberately not by neighbour_slug, which would
 * make it 11k entries and push the cached value toward the Data Cache
 * entry-size limit.
 */
export const getNeighbourSlugIndex = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabase = getServerSupabase();

    // Distinct neighbour names. PostgREST has no DISTINCT, so page through
    // and dedupe here — 18,879 rows of a single short column.
    const names = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase
        .from("condo_neighbours")
        .select("neighbour_name")
        .not("neighbour_name", "is", null)
        .order("id")
        .range(offset, offset + 999);
      const chunk = (data ?? []) as Array<{ neighbour_name: string | null }>;
      for (const r of chunk) if (r.neighbour_name) names.add(r.neighbour_name);
      if (chunk.length < 1000) break;
      // Hard stop: this table is ~19k rows; anything past 50k means a
      // pagination bug, not a bigger table.
      if (offset > 50_000) break;
    }
    if (names.size === 0) return {};

    // Match against our catalogue in chunks — `.in()` goes into the query
    // string, and 818 names at once overflows a practical URL length.
    const out: Record<string, string> = {};
    const nameList = [...names];
    const CHUNK = 200;
    for (let i = 0; i < nameList.length; i += CHUNK) {
      const { data } = await supabase
        .from("condos_published")
        .select("name, slug")
        .in("name", nameList.slice(i, i + CHUNK))
        .not("slug", "is", null);
      for (const r of (data ?? []) as Array<{ name: string; slug: string }>) {
        // First slug wins; duplicate names across provinces are rare and
        // either target is a real page for that building's name.
        if (!(r.name in out)) out[r.name] = r.slug;
      }
    }
    return out;
  },
  ["neighbour-slug-index-v1"],
  { revalidate: 604800 },
);
