import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, type Lang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Stale Listings — RealData" };
  const t = getDictionary(lang).stale;
  return {
    title: `${t.title} — RealData`,
    description: t.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/stale`,
      languages: langAlternates("/stale"),
    },
  };
}

const PROVINCE_LABELS: Record<string, { en: string; ko: string; th: string }> = {
  bangkok: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
  ...Object.fromEntries(CITIES.map((c) => [c.slug, c.name])),
};

export default async function StalePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang).stale;
  const supabase = getServerSupabase();

  const { data } = await supabase
    .from("condos_published")
    .select("id, name, province, regions(name), active_listings_count, median_listing_dom_days, max_listing_dom_days")
    .gt("active_listings_count", 0)
    .not("median_listing_dom_days", "is", null)
    .order("median_listing_dom_days", { ascending: false })
    .limit(50);

  type Row = {
    id: string;
    name: string;
    province: string;
    regions: { name: string } | { name: string }[] | null;
    active_listings_count: number | null;
    median_listing_dom_days: number | null;
    max_listing_dom_days: number | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const provLabel = (slug: string) => {
    const p = PROVINCE_LABELS[slug];
    if (!p) return slug;
    return p[lang as Lang] ?? p.en;
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.title}</h1>
        <p className="text-zinc-400 mt-3 text-sm sm:text-base max-w-2xl leading-relaxed">
          {t.lead}
        </p>
        <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-500 max-w-2xl">
          {t.note}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="text-zinc-500 text-sm py-8">{t.empty}</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead className="text-zinc-400 text-[11px] uppercase tracking-wider border-b border-zinc-800">
            <tr>
              <th className="text-left py-2 font-semibold">{t.table.rank}</th>
              <th className="text-left py-2 font-semibold">{t.table.condo}</th>
              <th className="text-left py-2 font-semibold">{t.table.city}</th>
              <th className="text-right py-2 font-semibold">{t.table.listings}</th>
              <th className="text-right py-2 font-semibold">{t.table.dom}</th>
              <th className="text-right py-2 font-semibold">{t.table.maxDom}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const region = (Array.isArray(r.regions) ? r.regions[0] : r.regions)?.name ?? "—";
              const dom = r.median_listing_dom_days ?? 0;
              const maxDom = r.max_listing_dom_days ?? 0;
              const cls =
                dom > 90 ? "text-rose-400" :
                dom > 30 ? "text-orange-400" :
                "text-zinc-300";
              return (
                <tr key={r.id} className="border-b border-zinc-900">
                  <td className="py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                  <td className="py-3">
                    <Link
                      href={`/${lang}/condo/${r.id}`}
                      className="text-zinc-100 hover:text-blue-300 transition"
                    >
                      {r.name}
                    </Link>
                    <div className="text-[11px] text-zinc-500">{region}</div>
                  </td>
                  <td className="py-3 text-zinc-400 text-xs">{provLabel(r.province)}</td>
                  <td className="py-3 text-right text-zinc-300 tabular-nums">
                    {r.active_listings_count}
                  </td>
                  <td className={`py-3 text-right font-bold tabular-nums ${cls}`}>
                    {t.domDays(dom)}
                  </td>
                  <td className="py-3 text-right text-zinc-400 tabular-nums">
                    {t.domDays(maxDom)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
