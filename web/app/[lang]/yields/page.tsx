import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { isLang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

const PROVINCES = [
  { slug: "all",         label: "All Thailand" },
  { slug: "bangkok",     label: "Bangkok" },
  { slug: "phuket",      label: "Phuket" },
  { slug: "chon-buri",   label: "Chon Buri" },
  { slug: "chiang-mai",  label: "Chiang Mai" },
  { slug: "pattaya",     label: "Pattaya" },
];

type YieldRow = {
  id: string;
  name: string;
  url: string | null;
  province: string | null;
  gross_yield_pct: number;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  yield_sample_sale: number | null;
  yield_sample_rent: number | null;
  regions: { name: string } | { name: string }[] | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Yields — RealData" };
  const title = "Top rental-yield condos in Thailand — RealData";
  const description =
    "Bangkok and Thailand condos ranked by gross rental yield (annual rent ÷ sale price). " +
    "Compared against the Bank of Thailand MRR mortgage benchmark. " +
    "Independent measurement across hipflat, dotproperty, ddproperty, fazwaz.";
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/yields`,
      languages: langAlternates("/yields"),
    },
    openGraph: { title, description, url: `${SEO_SITE_URL}/${lang}/yields`, type: "website" },
  };
}

function formatTHB(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(2)}M`;
  return `฿${Math.round(v).toLocaleString()}`;
}

function regionLabel(r: YieldRow): string {
  const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  if (region?.name) return region.name;
  return (r.province ?? "").replace(/-/g, " ") || "—";
}

export default async function YieldsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ province?: string }>;
}) {
  const { lang } = await params;
  const { province: provFilter } = await searchParams;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();

  // Same sanity bounds as src/analysis/yield_digest.py — filter out obvious
  // price-parse outliers (yield > 25%, sale < ฿500k).
  let query = supabase
    .from("condos")
    .select(
      "id, name, url, province, " +
      "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
      "yield_sample_sale, yield_sample_rent, regions(name)",
    )
    .gte("gross_yield_pct", 3)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2)
    .eq("is_active", true)
    .order("gross_yield_pct", { ascending: false })
    .limit(100);

  if (provFilter && provFilter !== "all") {
    query = query.eq("province", provFilter);
  }

  const [{ data: rows }, mortgage] = await Promise.all([
    query,
    getCurrentMortgageRate(supabase),
  ]);

  const yields = (rows ?? []) as unknown as YieldRow[];
  const mrr = mortgage?.rate ?? null;

  // JSON-LD ItemList so AI Overviews can quote the ranking as a list result.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Top rental-yield condos in Thailand",
    description: "Condos ranked by gross rental yield, with MRR mortgage spread context.",
    itemListElement: yields.slice(0, 25).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${r.id}`,
      additionalProperty: [
        { "@type": "PropertyValue", name: "Gross yield (%)", value: r.gross_yield_pct },
        ...(mrr != null
          ? [{ "@type": "PropertyValue", name: "Spread vs MRR (pp)", value: +(r.gross_yield_pct - mrr).toFixed(2) }]
          : []),
        { "@type": "PropertyValue", name: "Avg sale price (THB)", value: r.avg_sale_price ?? 0 },
        { "@type": "PropertyValue", name: "Avg monthly rent (THB)", value: r.avg_monthly_rent ?? 0 },
      ],
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Top rental-yield condos in Thailand</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          Ranked by gross rental yield (12 × monthly rent ÷ sale price). Only
          condos with at least 2 sale and 2 rent listings are included; obvious
          price-parse outliers (yield &gt; 25%, sale &lt; ฿500k) are filtered.
          {mrr != null && (
            <>
              {" "}Spread is yield minus the current Thai{" "}
              <strong className="text-zinc-200">
                MRR {mrr.toFixed(2)}%
              </strong>{" "}
              (BOT, {mortgage!.period.slice(0, 7)}).
            </>
          )}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {PROVINCES.map((p) => {
          const active =
            (provFilter ?? "all") === p.slug;
          return (
            <Link
              key={p.slug}
              href={p.slug === "all" ? `/${lang}/yields` : `/${lang}/yields?province=${p.slug}`}
              className={`px-3 py-1.5 rounded-full border transition ${
                active
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>

      {yields.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
          No condos with computed yield in this filter yet. Yields require
          matched sale + rent listings on the same building.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-4 py-3">Condo</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-right px-4 py-3">Yield</th>
                {mrr != null && (
                  <th className="text-right px-4 py-3">Spread</th>
                )}
                <th className="text-right px-4 py-3">Avg sale</th>
                <th className="text-right px-4 py-3">Avg rent</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">n</th>
              </tr>
            </thead>
            <tbody>
              {yields.map((r, i) => {
                const spread = mrr != null ? r.gross_yield_pct - mrr : null;
                return (
                  <tr key={r.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${lang}/condo/${r.id}`}
                        className="text-zinc-100 hover:underline font-medium"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 capitalize">{regionLabel(r)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {r.gross_yield_pct.toFixed(2)}%
                    </td>
                    {mrr != null && (
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          spread != null && spread >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {spread != null
                          ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}pp`
                          : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">{formatTHB(r.avg_sale_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatTHB(r.avg_monthly_rent)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs hidden sm:table-cell">
                      {r.yield_sample_sale ?? 0}/{r.yield_sample_rent ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
        <p>
          Gross yield = (12 × average monthly rent) ÷ average sale price. It is
          a pre-tax, pre-vacancy figure. Real net yield is typically{" "}
          <strong>1.5–3pp lower</strong> after vacancy, maintenance, CAM fees,
          and management. A positive spread vs. MRR means the rental income
          alone covers more than the mortgage interest a Thai bank would charge
          today.
        </p>
      </section>

      <LeadCaptureCTA
        headline="Pick one of these and want a deeper read?"
      />
    </main>
  );
}
