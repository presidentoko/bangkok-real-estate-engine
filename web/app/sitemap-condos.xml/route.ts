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
export const maxDuration = 300;

export async function GET(): Promise<Response> {
  const supabase = getServerSupabase();
  const today = isoDate(new Date());
  const entries: string[] = [];

  const PAGE = 1000;
  let offset = 0;

  while (true) {
    const { data } = await supabase
      .from("condos_published")
      .select("slug, last_seen_at")
      .not("slug", "is", null)
      .not("latitude", "is", null)
      .range(offset, offset + PAGE - 1);

    const rows = (data ?? []) as Array<{
      slug: string;
      last_seen_at: string | null;
    }>;
    if (rows.length === 0) break;

    for (const r of rows) {
      // Hard guard: skip any slug that is still a UUID (migration safety net)
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

    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  return xmlResponse(urlsetDoc(entries));
}
