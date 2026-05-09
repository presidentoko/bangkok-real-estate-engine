import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/cities";
import { LANGS } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase";

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
  { path: "/contact", changeFrequency: "yearly" as const, priority: 0.5 },
  { path: "/blog/bangkok-overpriced-top10", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-foreigner-best-value", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-flood-risky-popular", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-foreign-buyer-guide-2026", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog/sukhumvit-vs-sathorn-condo-comparison", changeFrequency: "weekly" as const, priority: 0.7 },
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

  // Condo report pages — only geo-located ones (rest have no real data).
  const supabase = getServerSupabase();
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

  return out;
}
