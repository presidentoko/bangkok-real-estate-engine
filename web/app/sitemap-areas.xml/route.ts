import { LANGS } from "@/lib/i18n";
import { BEST_CITIES, BEST_FILTERS } from "@/lib/bestSlugs";
import { CITIES, canonicalCitySlug, cityProvinceSlugs } from "@/lib/cities";
import { getServerSupabase } from "@/lib/supabase";
import { getViableStations } from "@/lib/queries/stations";
import {
  SITE_URL,
  urlEntry,
  urlsetDoc,
  xmlResponse,
  isoDate,
} from "@/lib/sitemap-helpers";

export const revalidate = 3600;
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const today = isoDate(new Date());
  const entries: string[] = [];
  const supabase = getServerSupabase();

  // City hub pages
  for (const lang of LANGS) {
    for (const city of CITIES) {
      const path = `/city/${city.slug}`;
      entries.push(
        urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "weekly", priority: 0.7, path })
      );
    }
  }

  // Best filter landings — 9 cities × 7 filters × 3 langs, but only for
  // combos that currently have ≥1 matching condo. Same eligibility bars as
  // app/[lang]/best/[city]/[slug]/page.tsx (is_active, sale/rent sample ≥2,
  // avg_sale_price ≥500k, gross_yield_pct between 3 and 25). A zero-match
  // slice renders as a "No matches yet" page at 200 — a soft-404 candidate
  // — so it's left out of the sitemap until real data backs it, mirroring
  // the ≥3-condos gate already used below for district pages.
  const { data: bestCandidates } = await supabase
    .from("condos")
    .select("province, gross_yield_pct, avg_sale_price")
    .eq("is_active", true)
    .not("gross_yield_pct", "is", null)
    .gte("gross_yield_pct", 3)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2)
    .limit(20_000);
  type BestCandidateRow = { province: string | null; gross_yield_pct: number | null; avg_sale_price: number | null };
  const bestRows = (bestCandidates ?? []) as BestCandidateRow[];

  for (const city of BEST_CITIES) {
    const provinces = new Set(cityProvinceSlugs(canonicalCitySlug(city.slug)));
    const cityRows = bestRows.filter((r) => r.province && provinces.has(r.province));
    for (const filter of BEST_FILTERS) {
      const minYield = filter.minYield ?? 3;
      const matched = cityRows.filter(
        (r) =>
          (r.gross_yield_pct ?? 0) >= minYield &&
          (filter.maxSale == null || (r.avg_sale_price ?? Infinity) <= filter.maxSale),
      ).length;
      if (matched === 0) continue;
      const path = `/best/${city.slug}/${filter.slug}`;
      for (const lang of LANGS) {
        entries.push(
          urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "weekly", priority: 0.65, path })
        );
      }
    }
  }

  // Retiree city pages
  for (const lang of LANGS) {
    for (const city of CITIES) {
      const path = `/retiree/${city.slug}`;
      entries.push(
        urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "weekly", priority: 0.8, path })
      );
    }
  }

  // District pages — only regions with ≥3 condos
  const { data: regionData } = await supabase
    .from("regions")
    .select("name, condos(id)")
    .limit(500);
  type RegionRow = { name: string; condos: { id: string }[] | null };
  for (const r of (regionData ?? []) as RegionRow[]) {
    if ((r.condos ?? []).length < 3 || !r.name) continue;
    // encodeURIComponent keeps XML valid for names with spaces/Thai chars;
    // Next.js decodes params so resolveRegion() gets the original string.
    const path = `/district/${encodeURIComponent(r.name)}`;
    for (const lang of LANGS) {
      entries.push(
        urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "weekly", priority: 0.7, path })
      );
    }
  }

  // Station spoke pages (cached internally — fast after first call)
  const stations = await getViableStations().catch(() => []);
  for (const s of stations) {
    const path = `/near/${s.slug}`;
    for (const lang of LANGS) {
      entries.push(
        urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "weekly", priority: 0.6, path })
      );
    }
  }

  // Developer lens pages
  const { data: devRows } = await supabase
    .from("condos_published")
    .select("developer_slug")
    .not("developer_slug", "is", null);
  const devSlugs = [
    ...new Set(
      (devRows ?? []).map((r: { developer_slug: string }) => r.developer_slug)
    ),
  ];
  for (const devSlug of devSlugs) {
    const path = `/developer/${devSlug}`;
    for (const lang of LANGS) {
      entries.push(
        urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "monthly", priority: 0.6, path })
      );
    }
  }

  return xmlResponse(urlsetDoc(entries));
}
