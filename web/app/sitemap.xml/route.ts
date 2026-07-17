import { getServerSupabase } from "@/lib/supabase";
import { SITE_URL, sitemapIndexDoc, xmlResponse, isoDate } from "@/lib/sitemap-helpers";

export const revalidate = 86400;
export const maxDuration = 15;

const CONDOS_PER_PAGE = 2500;

// TEMPORARY (added 2026-07-17, self-expires 2026-08-04 alongside the other
// egress mitigations in web/middleware.ts). Googlebot was just let back
// through the condo bot-block (see middleware.ts SEARCH_ENGINE_UA_RE), but a
// full crawl of the ~111k-page condo backlog before the Supabase free-tier
// egress budget resets could tip the project into another lockout. Bound
// discovery to the first 2 pages (~5k condos x 3 langs = ~15k URLs) instead
// of the full sitemap so Google can resume indexing without re-crawling
// everything at once; the rest reappears automatically once this expires.
const SITEMAP_THROTTLE_UNTIL = "Tue, 04 Aug 2026 00:00:00 GMT";
const THROTTLED_MAX_PAGES = 2;

export async function GET(): Promise<Response> {
  const lastmod = isoDate(new Date());

  // Count live condos to avoid listing empty pages in the index.
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("condos_published")
    .select("id", { count: "exact", head: true })
    .not("slug", "is", null)
    .not("latitude", "is", null);

  let totalPages = Math.ceil((count ?? 0) / CONDOS_PER_PAGE);
  if (Date.now() < Date.parse(SITEMAP_THROTTLE_UNTIL)) {
    totalPages = Math.min(totalPages, THROTTLED_MAX_PAGES);
  }
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
