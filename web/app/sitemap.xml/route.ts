import { INDEXABILITY_OR_FILTER } from "@/lib/condoIndexability";
import { getServerSupabase } from "@/lib/supabase";
import { SITE_URL, sitemapIndexDoc, xmlResponse, isoDate } from "@/lib/sitemap-helpers";

export const revalidate = 86400;
export const maxDuration = 15;

const CONDOS_PER_PAGE = 2500;

export async function GET(): Promise<Response> {
  const lastmod = isoDate(new Date());

  // Count the condos that pass the substance gate, not every published row,
  // so the index doesn't advertise pages sitemap-condos.xml now filters
  // away. Same .or() the page route uses — see lib/condoIndexability.ts for
  // why the gate exists at all.
  //
  // (The SITEMAP_THROTTLE_UNTIL cap that used to sit here expired
  // 2026-08-04 and was removed 2026-08-17. It was doing the right thing for
  // the wrong reason: what needed bounding was never the *number* of condo
  // URLs, it was the number of empty ones. When it lapsed, GSC's "not
  // indexed" count went 21,080 -> 39,555 in a day.)
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("condos_published")
    .select("id", { count: "exact", head: true })
    .not("slug", "is", null)
    .or(INDEXABILITY_OR_FILTER);

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
