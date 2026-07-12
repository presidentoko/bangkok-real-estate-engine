import { LANGS } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase";
import {
  SITE_URL,
  UUID_RE,
  urlEntry,
  urlsetDoc,
  xmlResponse,
  isoDate,
} from "@/lib/sitemap-helpers";

// No `revalidate` export here — this route reads `url.searchParams` below,
// which makes it dynamic regardless, so a revalidate export would be dead
// code. Actual caching comes from the `s-maxage=86400` the xmlResponse()
// helper sets directly.
export const maxDuration = 60;

// 2,500 condos × 3 langs = 7,500 entries ≈ ~5MB per page
const CONDOS_PER_PAGE = 2500;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10));
  const offset = page * CONDOS_PER_PAGE;

  const supabase = getServerSupabase();
  const today = isoDate(new Date());
  const entries: string[] = [];

  // PostgREST caps every single request at 1000 rows regardless of the
  // .range() size requested, so a single 2,500-row range silently drops
  // rows 1000-2499. Walk this page's 2,500-row block in ≤1000-row
  // sub-requests instead — the sitemap page boundaries (and therefore URLs)
  // stay unchanged.
  const rows: Array<{ slug: string; last_seen_at: string | null }> = [];
  const SUB_PAGE = 1000;
  for (let sub = 0; sub < CONDOS_PER_PAGE; sub += SUB_PAGE) {
    const from = offset + sub;
    const to = offset + Math.min(sub + SUB_PAGE, CONDOS_PER_PAGE) - 1;
    const { data } = await supabase
      .from("condos_published")
      .select("slug, last_seen_at")
      .not("slug", "is", null)
      .not("latitude", "is", null)
      .range(from, to);
    const chunk = (data ?? []) as Array<{
      slug: string;
      last_seen_at: string | null;
    }>;
    rows.push(...chunk);
    if (chunk.length < to - from + 1) break; // exhausted the table
  }

  for (const r of rows) {
    if (UUID_RE.test(r.slug)) continue;
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
