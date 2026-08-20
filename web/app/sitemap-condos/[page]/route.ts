import { LANGS } from "@/lib/i18n";
import {
  INDEXABILITY_OR_FILTER,
  INDEXABILITY_SELECT,
  hasIndexableSubstance,
} from "@/lib/condoIndexability";
import { getServerSupabase } from "@/lib/supabase";
import {
  SITE_URL,
  UUID_RE,
  urlEntry,
  urlsetDoc,
  xmlResponse,
  isoDate,
} from "@/lib/sitemap-helpers";

// The page number is a path segment, not `?page=`, and that is the whole
// point of this route existing.
//
// Reading url.searchParams made the old /sitemap-condos.xml?page=N handler
// dynamic, and Next strips a dynamic route handler's Cache-Control down to a
// bare `public` — the s-maxage=86400 that xmlResponse() sets never reached
// the CDN. Measured 2026-08-20: every single fetch answered
// `x-vercel-cache: MISS` in 5.65s, running ten paginated Supabase reads and
// pushing ~120KB (5.1MB uncompressed) from the origin, on a project sitting
// at 9.79GB of a 10GB Fast Origin Transfer cap. As a static segment it is
// ISR-cached like sitemap-areas.xml, which answers HIT.
export const revalidate = 86400;
export const dynamicParams = true;
export const maxDuration = 60;

// Prebuild the pages that exist today; dynamicParams covers the next one the
// catalogue grows into before a deploy catches up.
export function generateStaticParams() {
  return [{ page: "0" }, { page: "1" }, { page: "2" }];
}

// 2,500 condos × 3 langs = 7,500 entries ≈ ~5MB per page
const CONDOS_PER_PAGE = 2500;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
): Promise<Response> {
  const { page: rawPage } = await params;
  const parsedPage = parseInt(rawPage, 10);
  // A malformed page segment (e.g. "abc") parses to NaN, which survived
  // Math.max(0, NaN) === NaN and produced a NaN .range() -> a swallowed
  // PostgREST error -> an empty-but-200 urlset instead of a clear failure.
  const page = Math.max(0, Number.isFinite(parsedPage) ? parsedPage : 0);
  const offset = page * CONDOS_PER_PAGE;

  const supabase = getServerSupabase();
  const today = isoDate(new Date());
  const entries: string[] = [];

  // PostgREST caps every single request at 1000 rows regardless of the
  // .range() size requested, so a single 2,500-row range silently drops
  // rows 1000-2499. Walk this page's 2,500-row block in ≤1000-row
  // sub-requests instead — the sitemap page boundaries (and therefore URLs)
  // stay unchanged.
  //
  // The .or() is the substance gate (lib/condoIndexability.ts): only
  // buildings we can actually say something about get submitted. This used
  // to be every published condo with a slug — 14,071 buildings, 42,213 URLs
  // — of which ~9,750 were empty stubs that Google dutifully discovered and
  // then declined to index, 27,730 of them as of 2026-08-17. Offsets are
  // applied *after* the filter, so page boundaries shift; that is fine,
  // sitemap-condos.xml?page=N is not a stable identity anyone links to.
  type Row = {
    slug: string;
    last_seen_at: string | null;
    active_listings_count: number | null;
    market_sale_median: number | null;
    market_rent_median: number | null;
    gross_yield_pct: number | null;
    description: string | null;
    google_review_count: number | null;
  };
  const rows: Row[] = [];
  const SUB_PAGE = 1000;
  for (let sub = 0; sub < CONDOS_PER_PAGE; sub += SUB_PAGE) {
    const from = offset + sub;
    const to = offset + Math.min(sub + SUB_PAGE, CONDOS_PER_PAGE) - 1;
    const { data } = await supabase
      .from("condos_published")
      .select(`slug, last_seen_at, ${INDEXABILITY_SELECT}`)
      .not("slug", "is", null)
      .or(INDEXABILITY_OR_FILTER)
      .order("id")
      .range(from, to);
    const chunk = (data ?? []) as unknown as Row[];
    rows.push(...chunk);
    if (chunk.length < to - from + 1) break; // exhausted the table
  }

  for (const r of rows) {
    if (UUID_RE.test(r.slug)) continue;
    // The .or() above is a coarse pre-filter (it can't measure description
    // length); re-apply the real predicate so the sitemap and the pages'
    // own robots meta never disagree about what is indexable.
    if (!hasIndexableSubstance(r)) continue;
    const path = `/condo/${r.slug}`;
    const lastmod = r.last_seen_at ? isoDate(r.last_seen_at) : today;
    for (const lang of LANGS) {
      entries.push(
        urlEntry({
          loc: `${SITE_URL}/${lang}${path}`,
          lastmod,
          changefreq: "weekly",
          priority: 0.6,
          path,
        })
      );
    }
  }

  return xmlResponse(urlsetDoc(entries));
}
