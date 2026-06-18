import { LANGS } from "@/lib/i18n";
import { BEST_CITIES, BEST_FILTERS } from "@/lib/bestSlugs";
import { CITIES } from "@/lib/cities";
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

  // City hub pages
  for (const lang of LANGS) {
    for (const city of CITIES) {
      const path = `/city/${city.slug}`;
      entries.push(
        urlEntry({ loc: `${SITE_URL}/${lang}${path}`, lastmod: today, changefreq: "weekly", priority: 0.7, path })
      );
    }
  }

  // Best filter landings — 9 cities × 7 filters × 3 langs
  for (const lang of LANGS) {
    for (const city of BEST_CITIES) {
      for (const filter of BEST_FILTERS) {
        const path = `/best/${city.slug}/${filter.slug}`;
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

  const supabase = getServerSupabase();

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
