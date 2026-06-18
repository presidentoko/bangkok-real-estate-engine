import { LANGS } from "@/lib/i18n";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Matches UUID-format slugs — guard against un-migrated condo rows */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** YYYY-MM-DD for sitemap lastmod */
export function isoDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** hreflang <xhtml:link> elements for a canonical path (no lang prefix) */
export function hreflangLinks(path: string): string[] {
  const out: string[] = [
    `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${SITE_URL}/en${path}`)}"/>`,
  ];
  for (const lang of LANGS) {
    out.push(
      `<xhtml:link rel="alternate" hreflang="${lang}" href="${esc(`${SITE_URL}/${lang}${path}`)}"/>`
    );
  }
  return out;
}

export function urlEntry({
  loc,
  lastmod,
  changefreq,
  priority,
  path,
}: {
  loc: string;
  lastmod: string;
  changefreq?: string;
  priority?: number;
  /** Path without lang prefix — drives hreflang alternates */
  path?: string;
}): string {
  const lines = [
    "  <url>",
    `    <loc>${esc(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
  ];
  if (changefreq) lines.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority != null) lines.push(`    <priority>${priority}</priority>`);
  if (path) lines.push(...hreflangLinks(path).map((l) => `    ${l}`));
  lines.push("  </url>");
  return lines.join("\n");
}

export function urlsetDoc(entries: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    "</urlset>",
  ].join("\n");
}

export function sitemapIndexDoc(
  sitemaps: Array<{ loc: string; lastmod: string }>
): string {
  const items = sitemaps.map(
    ({ loc, lastmod }) =>
      `  <sitemap>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items,
    "</sitemapindex>",
  ].join("\n");
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
