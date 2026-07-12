import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fmtTHB } from "@/lib/fmt";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

// Developer stats only recompute weekly (compute_developer_stats.py runs in
// weekly-refresh POST_STEPS) — see condo/[slug]/page.tsx for the full
// ISR-overage context from 2026-07-10.
export const revalidate = 604800;

type Row = {
  id: string;
  slug: string | null;
  name: string;
  province: string | null;
  completion_year: number | null;
  total_units: number | null;
  avg_sale_price: number | null;
  gross_yield_pct: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  retiree_score: number | null;
  foreign_quota_inventory_pct: number | null;
};

// PostgREST caps every response at 1000 rows regardless of the query shape,
// so the old unpaginated select silently truncated to an arbitrary ~1000-row
// slice of developer_slug values (harmless today since missing slugs still
// fall back to on-demand ISR, but not an intentional top-N). Paginate the
// same way sitemap-areas.xml's devSlugSet loop already does for the
// equivalent query.
export async function generateStaticParams() {
  const supabase = getServerSupabase();
  const slugSet = new Set<string>();
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data } = await supabase
      .from("condos_published")
      .select("developer_slug")
      .not("developer_slug", "is", null)
      .range(offset, offset + page - 1);
    const chunk = (data ?? []) as Array<{ developer_slug: string }>;
    for (const r of chunk) slugSet.add(r.developer_slug);
    if (chunk.length < page) break;
  }
  return [...slugSet].map((s) => ({ slug: s }));
}

// generateMetadata() and the page body both need the same developer-meta
// row for this slug; wrapping in React's cache() collapses the two call
// sites into a single Supabase round trip per request (same pattern as
// condo/[slug]/page.tsx's getCondoFullById).
const getDevMeta = cache(async (slug: string) => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("condos_published")
    .select("developer, developer_project_count, developer_unit_count")
    .eq("developer_slug", slug)
    .limit(1);
  return data?.[0] ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  if (!isLang(lang)) return { title: "Developer" };

  const dev = await getDevMeta(slug);
  if (!dev) return { title: "Developer" };

  const title = `${dev.developer} Condos in Thailand — Track Record | RealData`;
  const description =
    `${dev.developer_project_count ?? "?"} projects · ${dev.developer_unit_count?.toLocaleString() ?? "?"} units built. ` +
    `Browse all ${dev.developer} condos with yield, price, and retiree score data.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/developer/${slug}`,
      languages: langAlternates(`/developer/${slug}`),
    },
    openGraph: { title, description, url: `${SEO_SITE_URL}/${lang}/developer/${slug}`, type: "website" },
  };
}

export default async function DeveloperPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("condos_published")
    .select(
      "id, slug, name, province, completion_year, total_units, avg_sale_price, " +
        "gross_yield_pct, google_rating, google_review_count, retiree_score, " +
        "foreign_quota_inventory_pct"
    )
    .eq("developer_slug", slug)
    .order("avg_sale_price", { ascending: false, nullsFirst: false });

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) notFound();

  // Developer meta (from first row — same across all rows for this slug).
  // Shares the generateMetadata() lookup via cache() instead of re-querying.
  const dev = await getDevMeta(slug);
  const devName: string = dev?.developer ?? slug;
  const projectCount: number | null = dev?.developer_project_count ?? null;
  const unitCount: number | null = dev?.developer_unit_count ?? null;

  // Portfolio stats
  const withYield = rows.filter((r) => r.gross_yield_pct != null);
  const avgYield =
    withYield.length > 0
      ? withYield.reduce((s, r) => s + r.gross_yield_pct!, 0) / withYield.length
      : null;

  const withRating = rows.filter((r) => r.google_rating != null);
  const avgRating =
    withRating.length > 0
      ? withRating.reduce((s, r) => s + r.google_rating!, 0) / withRating.length
      : null;

  const retireeFriendly = rows.filter((r) => (r.retiree_score ?? 0) >= 55).length;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${devName} Condos`,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 20).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${r.slug ?? r.id}`,
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <header className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          RealData · Developer lens
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{devName}</h1>
        <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed">
          {projectCount != null && `${projectCount.toLocaleString()} projects · `}
          {unitCount != null && `${unitCount.toLocaleString()} units built. `}
          {rows.length} condos in RealData database with verified market data.
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        <Stat
          label="Condos tracked"
          value={String(rows.length)}
        />
        <Stat
          label="Avg yield"
          value={avgYield != null ? `${avgYield.toFixed(2)}%` : "—"}
        />
        <Stat
          label="Avg Google rating"
          value={avgRating != null ? `${avgRating.toFixed(1)} ★` : "—"}
        />
      </section>

      {retireeFriendly > 0 && (
        <p className="text-sm text-emerald-400">
          {retireeFriendly} of {rows.length} condos score ≥ 55 on the Retiree Suitability Index.
        </p>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <table className="w-full text-sm hidden sm:table">
          <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3">Condo</th>
              <th className="text-right px-4 py-3">Year</th>
              <th className="text-right px-4 py-3">Units</th>
              <th className="text-right px-4 py-3">Sale</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Yield</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">Rating</th>
              <th className="text-right px-4 py-3 hidden lg:table-cell">Retiree</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/${lang}/condo/${r.slug ?? r.id}`}
                    className="text-zinc-100 hover:underline font-medium"
                  >
                    {r.name}
                  </Link>
                  {r.province && (
                    <span className="ml-2 text-xs text-zinc-500 capitalize">
                      {r.province.replace(/-/g, " ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                  {r.completion_year ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                  {r.total_units ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmtTHB(r.avg_sale_price)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                  {r.gross_yield_pct != null ? `${r.gross_yield_pct.toFixed(2)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                  {r.google_rating != null
                    ? `${r.google_rating.toFixed(1)} (${r.google_review_count ?? 0})`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                  {r.retiree_score != null ? (
                    <span className={(r.retiree_score >= 75 ? "text-emerald-300" : r.retiree_score >= 55 ? "text-emerald-400" : "text-zinc-500")}>
                      {r.retiree_score.toFixed(0)}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile */}
        <ul className="sm:hidden divide-y divide-zinc-800/70">
          {rows.map((r) => (
            <li key={r.id} className="p-3">
              <Link href={`/${lang}/condo/${r.slug ?? r.id}`} className="block space-y-1">
                <div className="text-zinc-100 font-medium leading-snug">{r.name}</div>
                <div className="flex gap-3 text-xs text-zinc-500 tabular-nums">
                  {r.completion_year && <span>{r.completion_year}</span>}
                  <span>Sale {fmtTHB(r.avg_sale_price)}</span>
                  {r.gross_yield_pct != null && <span>· {r.gross_yield_pct.toFixed(2)}% yield</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
        <p>
          Developer project and unit counts sourced from property registry data.
          Yield, price, and rating data updated as listings change.
          Retiree Suitability Score ≥ 55 = Good or better (healthcare, air quality, transit, errands).
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl sm:text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
