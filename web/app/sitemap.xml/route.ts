import { SITE_URL, sitemapIndexDoc, xmlResponse, isoDate } from "@/lib/sitemap-helpers";

export const revalidate = 3600;
export const maxDuration = 10;

export async function GET(): Promise<Response> {
  const lastmod = isoDate(new Date());
  return xmlResponse(
    sitemapIndexDoc([
      { loc: `${SITE_URL}/sitemap-static.xml`, lastmod },
      { loc: `${SITE_URL}/sitemap-areas.xml`, lastmod },
      { loc: `${SITE_URL}/sitemap-condos.xml`, lastmod },
    ])
  );
}
