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

export const revalidate = 3600;
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

  const { data } = await supabase
    .from("condos_published")
    .select("slug, last_seen_at")
    .not("slug", "is", null)
    .not("latitude", "is", null)
    .range(offset, offset + CONDOS_PER_PAGE - 1);

  const rows = (data ?? []) as Array<{
    slug: string;
    last_seen_at: string | null;
  }>;

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
