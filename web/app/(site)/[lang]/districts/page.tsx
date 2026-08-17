import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { provinceDisplayName } from "@/lib/cities";
import { fmtTHB } from "@/lib/fmt";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import { getServerSupabase } from "@/lib/supabase";

// The district index. Added 2026-08-17 to fix an internal-linking hole:
// /district/<slug> pages carry the site's most rankable content (a real
// median sale price, rent and yield for a named Bangkok/Phuket/Chiang Mai
// area) and there were 154 of them, but nothing linked to them except
// individual condo pages and the sitemap. No hub, no nav entry, no path a
// reader could take from the homepage. Districts were effectively orphans:
// discoverable in principle, never surfaced in practice.
//
// This page is also a ranking candidate in its own right — a single table
// of every district's median sale/rent/yield is the comparison a buyer
// actually wants and is not something the listing portals publish.
export const revalidate = 604800;

type CondoRow = {
  region_id: string | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  market_sale_median: number | null;
  market_rent_median: number | null;
};

type RegionRow = { id: string; name: string; province: string | null };

export type DistrictSummary = {
  slug: string;
  display: string;
  province: string | null;
  count: number;
  medianYield: number | null;
  medianSale: number | null;
  medianRent: number | null;
};

/** Same >=3-condo bar as sitemap-areas.xml and district/[slug]'s robots
 *  gate — a district we would not ask Google to index should not be
 *  advertised here either. */
const MIN_CONDOS = 3;

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

async function fetchDistricts(): Promise<DistrictSummary[]> {
  const supabase = getServerSupabase();

  const { data: regionData } = await supabase
    .from("regions")
    .select("id, name, province")
    .order("name")
    .range(0, 999);
  const regions = (regionData ?? []) as RegionRow[];
  if (regions.length === 0) return [];

  // PostgREST caps every request at 1000 rows regardless of .limit(), so
  // this walks the table rather than trusting a single wide select — the
  // same trap that silently truncated sitemap-areas.xml's /best eligibility
  // check to the first 1000 candidates.
  const condos: CondoRow[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await supabase
      .from("condos")
      .select(
        "region_id, gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
        "market_sale_median, market_rent_median",
      )
      .eq("is_active", true)
      .eq("published", true)
      .not("region_id", "is", null)
      .order("id")
      .range(offset, offset + 999);
    const chunk = (data ?? []) as unknown as CondoRow[];
    condos.push(...chunk);
    if (chunk.length < 1000) break;
    offset += 1000;
  }

  const byRegion = new Map<string, CondoRow[]>();
  for (const c of condos) {
    if (!c.region_id) continue;
    const list = byRegion.get(c.region_id);
    if (list) list.push(c);
    else byRegion.set(c.region_id, [c]);
  }

  const out: DistrictSummary[] = [];
  for (const r of regions) {
    const rows = byRegion.get(r.id) ?? [];
    if (rows.length < MIN_CONDOS || !r.name) continue;
    out.push({
      slug: encodeURIComponent(r.name.toLowerCase()),
      display: r.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      province: r.province,
      count: rows.length,
      // Same sanity bounds the district page itself applies, so a district's
      // row here and its own page never disagree.
      medianYield: median(
        rows.map((c) => c.gross_yield_pct).filter((v): v is number => v != null && v > 0 && v < 30),
      ),
      medianSale: median(
        rows
          .map((c) => c.avg_sale_price ?? c.market_sale_median)
          .filter((v): v is number => !!v && v >= 500_000),
      ),
      medianRent: median(
        rows
          .map((c) => c.avg_monthly_rent ?? c.market_rent_median)
          .filter((v): v is number => !!v && v >= 1_000),
      ),
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const safeLang = isLang(lang) ? lang : "en";
  const t = getDictionary(safeLang).districtsIndex;
  return {
    title: t.seoTitle,
    description: t.seoDesc,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/districts`,
      languages: langAlternates("/districts"),
    },
    openGraph: {
      title: t.seoTitle,
      description: t.seoDesc,
      url: `${SEO_SITE_URL}/${lang}/districts`,
      type: "website",
    },
  };
}

export default async function DistrictsIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const d = t.districtsIndex;
  const districts = await fetchDistricts();

  // ItemList so an answer engine asked "which Bangkok district has the
  // highest condo yield" can read the ranking without parsing the table.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: d.seoTitle,
    numberOfItems: districts.length,
    itemListElement: districts.slice(0, 100).map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.display,
      url: `${SEO_SITE_URL}/${lang}/district/${x.slug}`,
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: "RealData", href: `/${lang}` },
          { name: d.title, href: `/${lang}/districts` },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">{d.title}</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">{d.lead}</p>
        <p className="text-zinc-500 text-xs">{d.count(districts.length)}</p>
      </header>

      {districts.length === 0 ? (
        <p className="text-zinc-400 text-sm">{d.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3">{d.thDistrict}</th>
                <th className="text-left px-4 py-3">{d.thProvince}</th>
                <th className="text-right px-4 py-3">{d.thCondos}</th>
                <th className="text-right px-4 py-3">{d.thYield}</th>
                <th className="text-right px-4 py-3">{d.thSale}</th>
                <th className="text-right px-4 py-3">{d.thRent}</th>
              </tr>
            </thead>
            <tbody>
              {districts.map((x) => (
                <tr key={x.slug} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${lang}/district/${x.slug}`}
                      className="text-zinc-100 hover:text-emerald-400 hover:underline font-medium"
                    >
                      {x.display}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {provinceDisplayName(x.province ?? "bangkok", lang)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{x.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {x.medianYield != null ? `${x.medianYield.toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(x.medianSale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(x.medianRent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-500">{t.districtPage.source}</p>
    </main>
  );
}
