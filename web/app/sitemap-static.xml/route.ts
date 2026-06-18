import { LANGS } from "@/lib/i18n";
import { listWeeklyPosts } from "@/lib/weeklyPost";
import { allTermSlugs } from "@/lib/glossary";
import {
  SITE_URL,
  urlEntry,
  urlsetDoc,
  xmlResponse,
  isoDate,
} from "@/lib/sitemap-helpers";

export const revalidate = 3600;
export const maxDuration = 30;

const STATIC_PATHS = [
  { path: "", changefreq: "hourly", priority: 1.0 },
  { path: "/inventory", changefreq: "hourly", priority: 0.8 },
  { path: "/flood", changefreq: "weekly", priority: 0.9 },
  { path: "/reality", changefreq: "daily", priority: 0.7 },
  { path: "/blog", changefreq: "weekly", priority: 0.7 },
  { path: "/about", changefreq: "monthly", priority: 0.6 },
  { path: "/data", changefreq: "daily", priority: 0.8 },
  { path: "/stale", changefreq: "daily", priority: 0.7 },
  { path: "/press", changefreq: "monthly", priority: 0.5 },
  { path: "/contact", changefreq: "yearly", priority: 0.5 },
  { path: "/yields", changefreq: "weekly", priority: 0.9 },
  { path: "/macro", changefreq: "weekly", priority: 0.7 },
  { path: "/ask", changefreq: "monthly", priority: 0.7 },
  { path: "/compare", changefreq: "monthly", priority: 0.6 },
  { path: "/glossary", changefreq: "monthly", priority: 0.6 },
  { path: "/guide/foreign-ownership", changefreq: "monthly", priority: 0.7 },
  { path: "/guide/investment", changefreq: "weekly", priority: 0.8 },
  { path: "/retiree", changefreq: "weekly", priority: 0.8 },
  // Named static blog posts
  { path: "/blog/bangkok-overpriced-top10", changefreq: "weekly", priority: 0.6 },
  { path: "/blog/bangkok-foreigner-best-value", changefreq: "weekly", priority: 0.6 },
  { path: "/blog/bangkok-flood-risky-popular", changefreq: "weekly", priority: 0.6 },
  { path: "/blog/bangkok-foreign-buyer-guide-2026", changefreq: "weekly", priority: 0.7 },
  { path: "/blog/sukhumvit-vs-sathorn-condo-comparison", changefreq: "weekly", priority: 0.7 },
  { path: "/blog/phuket-bubble-watch", changefreq: "weekly", priority: 0.7 },
  { path: "/blog/chiang-mai-best-value-2026", changefreq: "weekly", priority: 0.7 },
  { path: "/blog/thailand-best-cities-for-retirees-2026", changefreq: "monthly", priority: 0.8 },
];

export async function GET(): Promise<Response> {
  const today = isoDate(new Date());
  const entries: string[] = [];

  // Static hub pages × 3 langs
  for (const lang of LANGS) {
    for (const sp of STATIC_PATHS) {
      entries.push(
        urlEntry({
          loc: `${SITE_URL}/${lang}${sp.path}`,
          lastmod: today,
          changefreq: sp.changefreq,
          priority: sp.priority,
          path: sp.path,
        })
      );
    }
  }

  // Auto-generated weekly posts (file system read — no DB)
  const weeklyPosts = await listWeeklyPosts().catch(() => []);
  for (const post of weeklyPosts) {
    const path = `/blog/weekly/${post.slug}`;
    const lastmod = isoDate(post.published_at);
    for (const lang of LANGS) {
      entries.push(
        urlEntry({
          loc: `${SITE_URL}/${lang}${path}`,
          lastmod,
          changefreq: "monthly",
          priority: 0.6,
          path,
        })
      );
    }
  }

  // Glossary term pages (in-memory, no DB)
  for (const slug of allTermSlugs()) {
    const path = `/glossary/${slug}`;
    for (const lang of LANGS) {
      entries.push(
        urlEntry({
          loc: `${SITE_URL}/${lang}${path}`,
          lastmod: today,
          changefreq: "monthly",
          priority: 0.5,
          path,
        })
      );
    }
  }

  return xmlResponse(urlsetDoc(entries));
}
