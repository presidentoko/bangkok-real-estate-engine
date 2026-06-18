import { SITE_URL, sitemapIndexDoc, xmlResponse, isoDate } from "@/lib/sitemap-helpers";

export const revalidate = 3600;
export const maxDuration = 10;

// 5 condo pages × 2,500 condos = capacity for 12,500 condos.
// Empty pages return a valid empty urlset — safe to list extras.
const CONDO_PAGES = [0, 1, 2, 3, 4];

export async function GET(): Promise<Response> {
  const lastmod = isoDate(new Date());
  return xmlResponse(
    sitemapIndexDoc([
      { loc: `${SITE_URL}/sitemap-static.xml`, lastmod },
      { loc: `${SITE_URL}/sitemap-areas.xml`, lastmod },
      ...CONDO_PAGES.map((p) => ({
        loc: `${SITE_URL}/sitemap-condos.xml?page=${p}`,
        lastmod,
      })),
    ])
  );
}
