import type { MetadataRoute } from "next";
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
  { path: "/blog/bangkok-overpriced-top10", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-foreigner-best-value", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-flood-risky-popular", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/blog/bangkok-foreign-buyer-guide-2026", changeFrequency: "weekly" as const, priority: 0.7 },
  { path: "/blog/sukhumvit-vs-sathorn-condo-comparison", changeFrequency: "weekly" as const, priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  // One entry per (lang, static path)
  for (const lang of LANGS) {
    for (const sp of STATIC_PATHS) {
      out.push({
        url: `${SITE_URL}/${lang}${sp.path}`,
        lastModified: now,
        changeFrequency: sp.changeFrequency,
        priority: sp.priority,
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
      for (const lang of LANGS) {
        out.push({
          url: `${SITE_URL}/${lang}/condo/${r.id}`,
          lastModified: lastMod,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return out;
}
