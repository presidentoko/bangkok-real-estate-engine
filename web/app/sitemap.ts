import type { MetadataRoute } from "next";
import { BEST_CITIES, BEST_FILTERS } from "@/lib/bestSlugs";
import { CITIES } from "@/lib/cities";
import { LANGS } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase";
import { listWeeklyPosts } from "@/lib/weeklyPost";
import { allTermSlugs } from "@/lib/glossary";
import { getViableStations } from "@/lib/queries/stations";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const revalidate = 3600;

const STATIC_PATHS = [
  { path: "", changeFrequency: "hourly" as const, priority: 1.0 },
  { path: "/inventory", changeFrequency: "hourly" as const, priority: 0.8 },
  { path: "/flood", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/reality", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/data", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/stale", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/press", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly" as const, priority: 0.5 },
  { path: "/yields", changeFrequency: "weekly" as const, priority: 0.9 },
  { path: "/macro", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/ask", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/compare", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/glossary", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/guide/foreign-ownership", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/guide/investment", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/blog/bangkok-overpriced-top10", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-foreigner-best-value", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-flood-risky-popular", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-foreign-buyer-guide-2026", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog/sukhumvit-vs-sathorn-condo-comparison", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog/phuket-bubble-watch", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog/chiang-mai-best-value-2026", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog/thailand-best-cities-for-retirees-2026", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/retiree", changeFrequency: "weekly" as const, priority: 0.8 },
];

function langAlternates(path: string): Record<string, string> {
  // Per-page hreflang map; same path under each locale + x-default → en.
  const out: Record<string, string> = { "x-default": `${SITE_URL}/en${path}` };
  for (const l of LANGS) out[l] = `${SITE_URL}/${l}${path}`;
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  // One entry per (lang, static path), each carrying language alternates so
  // Google understands the EN/KO/TH versions are siblings, not duplicates.
  for (const lang of LANGS) {
    for (const sp of STATIC_PATHS) {
      out.push({
        url: `${SITE_URL}/${lang}${sp.path}`,
        lastModified: now,
        changeFrequency: sp.changeFrequency,
        priority: sp.priority,
        alternates: { languages: langAlternates(sp.path) },
      });
    }
    // Per-city landing pages — Phuket, Chiang Mai, Pattaya, Hua Hin, Chonburi.
    for (const city of CITIES) {
      const path = `/city/${city.slug}`;
      out.push({
        url: `${SITE_URL}/${lang}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages: langAlternates(path) },
      });
    }
  }

  // Programmatic /best/[city]/[slug] landings — 9 cities × 7 filters × N langs.
  for (const lang of LANGS) {
    for (const city of BEST_CITIES) {
      for (const filter of BEST_FILTERS) {
        const path = `/best/${city.slug}/${filter.slug}`;
        out.push({
          url: `${SITE_URL}/${lang}${path}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.65,
          alternates: { languages: langAlternates(path) },
        });
      }
    }
  }

  // Retiree segment pages — 8 cities × N langs.
  for (const lang of LANGS) {
    for (const city of CITIES) {
      const path = `/retiree/${city.slug}`;
      out.push({
        url: `${SITE_URL}/${lang}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages: langAlternates(path) },
      });
    }
  }

  // District landing pages — one per region with at least 3 active condos.
  // We don't want to surface tiny single-condo regions or stale slugs.
  const supabase = getServerSupabase();
  const { data: regionData } = await supabase
    .from("regions")
    .select("name, condos(id)")
    .limit(500);
  type RegionWithCondos = { name: string; condos: { id: string }[] | null };
  const regions = (regionData ?? []) as RegionWithCondos[];
  for (const r of regions) {
    const count = (r.condos ?? []).length;
    if (count < 3 || !r.name) continue;
    const districtPath = `/district/${r.name}`;
    for (const lang of LANGS) {
      out.push({
        url: `${SITE_URL}/${lang}${districtPath}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages: langAlternates(districtPath) },
      });
    }
  }

  // Auto-generated weekly blog posts. Each entry sits at /blog/weekly/{slug}
  // and the JSON files in web/content/weekly/ are the source of truth.
  const weeklyPosts = await listWeeklyPosts();
  for (const post of weeklyPosts) {
    const wp = `/blog/weekly/${post.slug}`;
    for (const lang of LANGS) {
      out.push({
        url: `${SITE_URL}/${lang}${wp}`,
        lastModified: new Date(post.published_at),
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages: langAlternates(wp) },
      });
    }
  }

  // Condo report pages — only geo-located ones (rest have no real data).
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("condos_published")
      .select("id, last_seen_at")
      .eq("source", "hipflat")
      .not("latitude", "is", null)
      .range(offset, offset + PAGE - 1);
    const rows = (data ?? []) as Array<{ id: string; last_seen_at: string | null }>;
    if (rows.length === 0) break;
    for (const r of rows) {
      const lastMod = r.last_seen_at ? new Date(r.last_seen_at) : now;
      const condoPath = `/condo/${r.id}`;
      for (const lang of LANGS) {
        out.push({
          url: `${SITE_URL}/${lang}${condoPath}`,
          lastModified: lastMod,
          changeFrequency: "weekly",
          priority: 0.6,
          alternates: { languages: langAlternates(condoPath) },
        });
      }
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  // Glossary term pages.
  for (const slug of allTermSlugs()) {
    const gp = `/glossary/${slug}`;
    for (const lang of LANGS) {
      out.push({
        url: `${SITE_URL}/${lang}${gp}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages: langAlternates(gp) },
      });
    }
  }

  // Station spoke pages (only viable stations >= threshold).
  const stations = await getViableStations();
  for (const s of stations) {
    const np = `/near/${s.slug}`;
    for (const lang of LANGS) {
      out.push({
        url: `${SITE_URL}/${lang}${np}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: langAlternates(np) },
      });
    }
  }

  return out;
}
