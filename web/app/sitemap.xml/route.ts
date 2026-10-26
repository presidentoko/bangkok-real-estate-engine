import { INDEXABILITY_OR_FILTER } from "@/lib/condoIndexability";
import { getServerSupabase } from "@/lib/supabase";
import { SITE_URL, sitemapIndexDoc, xmlResponse, isoDate } from "@/lib/sitemap-helpers";
import { CONDO_STATIC_BUILD } from "@/lib/buildMode";

/**
 * The Cloudflare condo export prerenders every static route in the app, this
 * one included, and then throws all but /<lang>/condo/<slug> away --
 * collect.mjs copies nothing else. Until 2026-10-26 the three sitemap routes
 * with no dynamic segment were the only ones left ungated, because the
 * CONDO_STATIC_BUILD pattern lives in generateStaticParams and they have
 * none. Then /sitemap-areas.xml crossed Next's 180s prerender budget -- its
 * cost grows with the data, and that day's +370 yields widened the /best
 * eligibility scan behind it -- and took the whole export down with it,
 * three attempts and 10 minutes of build for a file nobody would publish.
 */
export const revalidate = 86400;
export const maxDuration = 15;

const CONDOS_PER_PAGE = 2500;

export async function GET(): Promise<Response> {
  // Nothing downstream of here is published by the export; skip the
  // dozens of Supabase round trips it would cost.
  if (CONDO_STATIC_BUILD) return xmlResponse(sitemapIndexDoc([]));

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
    loc: `${SITE_URL}/sitemap-condos/${p}.xml`,
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
