import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { canonicalCitySlug, cityProvinceSlugs } from "@/lib/cities";
import { isLang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
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
  slug: string | null;
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
  const title = "Top Rental Yield Condos in Bangkok & Thailand — Ranked vs Bank of Thailand Rate | RealData";
  const description =
    "Bangkok and Thailand condos ranked by gross rental yield (annual rent ÷ sale price). " +
    "Each building compared against the live Bank of Thailand MRR mortgage benchmark — positive spread means rent covers the mortgage. " +
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

import { fmtTHB } from "@/lib/fmt";

function regionLabel(r: YieldRow): string {
  const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  if (region?.name) return region.name;
  return (r.province ?? "").replace(/-/g, " ") || "—";
}

const SORT_OPTIONS = [
  { key: "yield",       column: "gross_yield_pct",   asc: false, label: "Highest yield"  },
  { key: "sale-asc",    column: "avg_sale_price",    asc: true,  label: "Cheapest sale"  },
  { key: "sale-desc",   column: "avg_sale_price",    asc: false, label: "Premium sale"   },
  { key: "rent-desc",   column: "avg_monthly_rent",  asc: false, label: "Highest rent"   },
  { key: "samples",     column: "yield_sample_sale", asc: false, label: "Most data"      },
] as const;

export default async function YieldsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ province?: string; sort?: string; min_yield?: string }>;
}) {
  const { lang } = await params;
  const { province: provFilter, sort: sortKey, min_yield: minYieldParam } = await searchParams;
  if (!isLang(lang)) notFound();

  const sortOpt =
    SORT_OPTIONS.find((s) => s.key === sortKey) ?? SORT_OPTIONS[0];
  const minYield = Math.max(
    3,
    Math.min(15, Number.isFinite(Number(minYieldParam)) ? Number(minYieldParam) : 3),
  );

  const supabase = getServerSupabase();

  // Same sanity bounds as src/analysis/yield_digest.py — filter out obvious
  // price-parse outliers (yield > 25%, sale < ฿500k).
  let query = supabase
    .from("condos")
    .select(
      "id, slug, name, url, province, " +
      "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
      "yield_sample_sale, yield_sample_rent, regions(name)",
    )
    .gte("gross_yield_pct", minYield)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2)
    .eq("is_active", true)
    .order(sortOpt.column, { ascending: sortOpt.asc })
    .limit(100);

  if (provFilter && provFilter !== "all") {
    // DB `province` has two slug conventions (e.g. "chonburi" and
    // "chon-buri"); match every alias for the selected city, not just the
    // exact string the chip links to.
    query = query.in("province", cityProvinceSlugs(canonicalCitySlug(provFilter)));
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
      url: `${SEO_SITE_URL}/${lang}/condo/${r.slug ?? r.id}`,
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

  const mrrLine =
    mrr != null
      ? `As of the latest BOT update, MRR is ${mrr.toFixed(2)}%. A yield of 6% therefore implies a +${(6 - mrr).toFixed(2)}pp spread.`
      : "Spread is shown wherever the current Bank of Thailand MRR is available.";
  const faqJsonLd = buildFaqJsonLd([
    {
      q: "How is gross rental yield calculated?",
      a: "Gross yield = (12 × median monthly rent ÷ median sale price) × 100%, computed per condo building. Only buildings with at least 2 sale and 2 rent listings are included. Listings priced in USD on hipflat are converted to THB before aggregation, and any yield above 25% is dropped as a likely price-parse error.",
    },
    {
      q: "What is the 'Spread vs MRR' column?",
      a: `Spread = gross yield minus the current Bank of Thailand Minimum Retail Rate (MRR). A positive spread means the rental income alone covers more than the mortgage interest a Thai bank would charge that day. ${mrrLine}`,
    },
    {
      q: "Why does my favourite condo not show up here?",
      a: "Two reasons. (1) The building doesn't have enough matched sale + rent listings yet — we need at least 2 of each on the same building. (2) The yield landed above 25% or the sale price below ฿500,000, which we filter as a likely outlier. Coverage will widen as we accumulate more weekly snapshots.",
    },
    {
      q: "Is the yield net of CAM fees and tax?",
      a: "No — this is a pre-tax, pre-vacancy gross figure. Net yield in Thailand is typically 1.5–3 percentage points lower after CAM (common area fees), sinking fund top-ups, the 15% withholding on rent for foreign owners, vacancy, and management commission. Each individual condo report shows a Cost of Ownership panel that estimates the net step-down.",
    },
    {
      q: "How current are these numbers?",
      a: "Listings are refreshed daily for Bangkok and weekly across the full Thailand sweep. Yields are recomputed after each ingest cycle, and the BOT MRR benchmark refreshes daily where the source publishes daily.",
    },
  ]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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

      <nav className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Province</span>
          {PROVINCES.map((p) => {
            const active = (provFilter ?? "all") === p.slug;
            const qs = new URLSearchParams();
            if (p.slug !== "all") qs.set("province", p.slug);
            if (sortOpt.key !== "yield") qs.set("sort", sortOpt.key);
            if (minYield !== 3) qs.set("min_yield", String(minYield));
            const q = qs.toString();
            return (
              <Link
                key={p.slug}
                href={q ? `/${lang}/yields?${q}` : `/${lang}/yields`}
                className={`px-3.5 py-2 rounded-full border transition ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Sort</span>
          {SORT_OPTIONS.map((s) => {
            const active = sortOpt.key === s.key;
            const qs = new URLSearchParams();
            if (provFilter && provFilter !== "all") qs.set("province", provFilter);
            if (s.key !== "yield") qs.set("sort", s.key);
            if (minYield !== 3) qs.set("min_yield", String(minYield));
            const q = qs.toString();
            return (
              <Link
                key={s.key}
                href={q ? `/${lang}/yields?${q}` : `/${lang}/yields`}
                className={`px-3.5 py-2 rounded-full border text-xs transition ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {yields.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
          No condos with computed yield in this filter yet. Yields require
          matched sale + rent listings on the same building.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards. Below sm the table overflows badly. */}
          <ul className="sm:hidden space-y-2">
            {yields.map((r, i) => {
              const spread = mrr != null ? r.gross_yield_pct - mrr : null;
              return (
                <li
                  key={r.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3"
                >
                  <Link
                    href={`/${lang}/condo/${r.slug ?? r.id}`}
                    className="block space-y-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-zinc-600 tabular-nums text-xs w-6 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-zinc-100 font-medium leading-snug">
                        {r.name}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 pl-8 flex-wrap">
                      <span className="text-zinc-400 capitalize text-xs">
                        {regionLabel(r)}
                      </span>
                      <span className="font-semibold tabular-nums text-base">
                        {r.gross_yield_pct.toFixed(2)}%
                      </span>
                      {spread != null && (
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            spread >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {spread >= 0 ? "+" : ""}
                          {spread.toFixed(2)}pp
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3 pl-8 text-xs text-zinc-500 tabular-nums">
                      <span>Sale {fmtTHB(r.avg_sale_price)}</span>
                      <span>· Rent {fmtTHB(r.avg_monthly_rent)}/mo</span>
                      <span>
                        · n={r.yield_sample_sale ?? 0}/{r.yield_sample_rent ?? 0}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Tablet+: full table. */}
          <div className="hidden sm:block rounded-2xl border border-zinc-800 bg-zinc-950 overflow-x-auto">
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
                        href={`/${lang}/condo/${r.slug ?? r.id}`}
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
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(r.avg_sale_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(r.avg_monthly_rent)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs hidden sm:table-cell">
                      {r.yield_sample_sale ?? 0}/{r.yield_sample_rent ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
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
