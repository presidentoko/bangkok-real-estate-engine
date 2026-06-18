import { getServerSupabase } from "@/lib/supabase";
import { SITE_URL, sitemapIndexDoc, xmlResponse, isoDate } from "@/lib/sitemap-helpers";

export const revalidate = 3600;
export const maxDuration = 15;

const CONDOS_PER_PAGE = 2500;

export async function GET(): Promise<Response> {
  const lastmod = isoDate(new Date());

  // Count live condos to avoid listing empty pages in the index.
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("condos_published")
    .select("id", { count: "exact", head: true })
    .not("slug", "is", null)
    .not("latitude", "is", null);

  const totalPages = Math.ceil((count ?? 0) / CONDOS_PER_PAGE);
  const condoSitemaps = Array.from({ length: totalPages }, (_, p) => ({
    loc: `${SITE_URL}/sitemap-condos.xml?page=${p}`,
    lastmod,
  }));

  return xmlResponse(
    sitemapIndexDoc([
      { loc: `${SITE_URL}/sitemap-static.xml`, lastmod },
      { loc: `${SITE_URL}/sitemap-areas.xml`, lastmod },
      ...condoSitemaps,
    ])
  );
}
