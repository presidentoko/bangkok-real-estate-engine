import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { TravelAffiliateCard } from "@/components/TravelAffiliateCard";
import {
  BEST_CITIES,
  BEST_FILTERS,
  getBestCity,
  getBestFilter,
  type BestCitySlug,
  type BestFilterSlug,
} from "@/lib/bestSlugs";
import { canonicalCitySlug, cityProvinceSlugs } from "@/lib/cities";
import { fmtTHB } from "@/lib/fmt";
import { isLang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 86400;

// Pre-render every (city, slug) combination at build time. With 9 cities
// × 7 slugs = 63 combos per language, that's a 1-shot static export
// price worth paying once for AI/search-engine indexability.
export function generateStaticParams() {
  const out: Array<{ city: BestCitySlug; slug: BestFilterSlug }> = [];
  for (const c of BEST_CITIES) {
    for (const f of BEST_FILTERS) out.push({ city: c.slug, slug: f.slug });
  }
  return out;
}

type Row = {
  id: string;
  slug: string | null;
  name: string;
  province: string | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  yield_sample_sale: number | null;
  yield_sample_rent: number | null;
  foreign_quota_inventory_pct: number | null;
  regions: { name: string } | { name: string }[] | null;
};

function regionLabel(r: Row): string {
  const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  return region?.name ?? (r.province ?? "").replace(/-/g, " ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; slug: string; lang: string }>;
}): Promise<Metadata> {
  const { city, slug, lang } = await params;
  const cityObj = getBestCity(city);
  const filterObj = getBestFilter(slug);
  if (!cityObj || !filterObj || !isLang(lang)) {
    return { title: "Best condos — RealData" };
  }
  const titleChunk = filterObj.titleChunk(cityObj.display);
  const title = `Best ${titleChunk} — RealData`;
  const description = filterObj.descChunk(cityObj.display);

  // Cheap count-only version of the page's main query — decides whether this
  // slice is a soft-404 (zero matches) so we can noindex it instead of
  // letting crawlers waste budget on an empty result page.
  const supabase = getServerSupabase();
  const provinces = cityProvinceSlugs(canonicalCitySlug(city));
  let countQuery = supabase
    .from("condos")
    .select("id", { count: "exact", head: true })
    .in("province", provinces)
    .eq("is_active", true)
    .not("gross_yield_pct", "is", null)
    .gte("gross_yield_pct", filterObj.minYield ?? 3)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2);
  if (filterObj.maxSale != null) {
    countQuery = countQuery.lte("avg_sale_price", filterObj.maxSale);
  }
  const { count } = await countQuery;

  return {
    title,
    description,
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/best/${city}/${slug}`,
      languages: langAlternates(`/best/${city}/${slug}`),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}/best/${city}/${slug}`,
      type: "website",
    },
  };
}

export default async function BestSlicePage({
  params,
}: {
  params: Promise<{ city: string; slug: string; lang: string }>;
}) {
  const { city, slug, lang } = await params;
  if (!isLang(lang)) notFound();
  const cityObj = getBestCity(city);
  const filterObj = getBestFilter(slug);
  if (!cityObj || !filterObj) notFound();

  const supabase = getServerSupabase();

  // condos.province has accumulated two slug conventions over time (see
  // lib/cities.ts) — match every DB variant for this city, not just the
  // kebab-case BEST_CITIES slug, or multi-word cities silently undercount.
  const provinces = cityProvinceSlugs(canonicalCitySlug(city));

  let query = supabase
    .from("condos")
    .select(
      "id, slug, name, province, gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
      "yield_sample_sale, yield_sample_rent, foreign_quota_inventory_pct, regions(name)",
    )
    .in("province", provinces)
    .eq("is_active", true)
    .not("gross_yield_pct", "is", null)
    // Same sanity bounds as /yields — keep the slice quote-able.
    .gte("gross_yield_pct", filterObj.minYield ?? 3)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2);

  if (filterObj.maxSale != null) {
    query = query.lte("avg_sale_price", filterObj.maxSale);
  }
  query = query.order("gross_yield_pct", { ascending: false }).limit(50);

  const [{ data: rowsData }, mortgage, { data: retireeData }] = await Promise.all([
    query,
    getCurrentMortgageRate(supabase),
    supabase
      .from("condos")
      .select("id, slug, name, retiree_score, regions(name)")
      .in("province", provinces)
      .eq("is_active", true)
      .gte("retiree_score", 55)
      .order("retiree_score", { ascending: false })
      .limit(5),
  ]);

  const rows = (rowsData ?? []) as unknown as Row[];
  type RetireeRow = { id: string; slug: string | null; name: string; retiree_score: number; regions: { name: string } | { name: string }[] | null };
  const retireeRows = (retireeData ?? []) as unknown as RetireeRow[];
  const mrr = mortgage?.rate ?? null;

  const titleChunk = filterObj.titleChunk(cityObj.display);
  const h1 = `Best ${titleChunk}`;

  // Aggregates for the stat strip + FAQ
  const yields = rows.map((r) => r.gross_yield_pct ?? 0).filter((y) => y > 0);
  const median = (arr: number[]) => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  };
  const medianYield = median(yields);
  const medianSale = median(rows.map((r) => r.avg_sale_price ?? 0).filter((v) => v > 0));
  const medianRent = median(rows.map((r) => r.avg_monthly_rent ?? 0).filter((v) => v > 0));

  // ItemList — quotable by AI Overviews as a ranked list result.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: h1,
    description: filterObj.descChunk(cityObj.display),
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 20).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${r.slug ?? r.id}`,
      additionalProperty: [
        { "@type": "PropertyValue", name: "Gross yield (%)", value: r.gross_yield_pct ?? 0 },
        ...(mrr != null && r.gross_yield_pct != null
          ? [{
              "@type": "PropertyValue",
              name: "Spread vs MRR (pp)",
              value: +(r.gross_yield_pct - mrr).toFixed(2),
            }]
          : []),
        { "@type": "PropertyValue", name: "Avg sale (THB)", value: r.avg_sale_price ?? 0 },
        { "@type": "PropertyValue", name: "Avg rent / mo (THB)", value: r.avg_monthly_rent ?? 0 },
        ...(r.foreign_quota_inventory_pct != null
          ? [{
              "@type": "PropertyValue",
              name: "Foreign-quota inventory (%)",
              value: r.foreign_quota_inventory_pct,
            }]
          : []),
      ],
    })),
  };

  const mrrLine =
    mrr != null && medianYield != null
      ? `Median yield in this slice is ${medianYield.toFixed(2)}%, a ${(medianYield - mrr >= 0 ? "+" : "")}${(medianYield - mrr).toFixed(2)}pp spread against the current Thai MRR of ${mrr.toFixed(2)}%.`
      : "Spread is shown wherever the current Bank of Thailand MRR is available.";

  const faqJsonLd = buildFaqJsonLd([
    {
      q: `How many ${titleChunk} does RealData currently measure?`,
      a:
        rows.length === 0
          ? `Right now zero — either the filter is tight or our coverage in this slice is thin. The /yields page shows the full Thailand ranking.`
          : `${rows.length} buildings match the filter, drawn from active sale and rent listings across hipflat, dotproperty, ddproperty, and fazwaz.`,
    },
    {
      q: `What is the median gross rental yield among these condos?`,
      a: mrrLine,
    },
    ...(medianSale != null
      ? [{
          q: `What is the median sale price in this slice?`,
          a: `Median sale price is ฿${Math.round(medianSale).toLocaleString()}. Median monthly rent is ${medianRent != null ? "฿" + Math.round(medianRent).toLocaleString() : "—"}. Both figures come from active listings on the four portals we track.`,
        }]
      : []),
    {
      q: `Why are some popular ${cityObj.display} condos missing?`,
      a:
        `A building has to clear two bars to enter this ranking: (1) at least 2 active sale and 2 active rent listings on the same building, so the yield is not a fluke; (2) avg sale price ≥ ฿500,000 and yield ≤ 25%, which filters obvious price-parse outliers. Coverage widens with every weekly ingest cycle.`,
    },
    {
      q: `How do I shortlist one of these?`,
      a:
        `Each building name links to its full RealData report — yield, foreign-quota inventory, flood risk, days-on-market, cost-of-ownership panel. The bottom of this page has a free expert-opinion request that goes to one vetted independent broker who knows ${cityObj.display}.`,
    },
  ]);

  // Sibling slugs in same city + same slug across all cities — internal
  // link surface for crawl depth. We deliberately keep it dense.
  const siblingSlugs = BEST_FILTERS.filter((f) => f.slug !== filterObj.slug);
  const siblingCities = BEST_CITIES.filter((c) => c.slug !== cityObj.slug);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          RealData · Curated yield slice
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight capitalize">
          {h1}
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          {filterObj.descChunk(cityObj.display)}
          {mrr != null && (
            <>
              {" "}Spread shown against current Thai MRR{" "}
              <strong className="text-zinc-200">{mrr.toFixed(2)}%</strong>.
            </>
          )}
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Matched" value={rows.length.toString()} />
        <Stat
          label="Median yield"
          value={medianYield != null ? `${medianYield.toFixed(2)}%` : "—"}
        />
        <Stat label="Median sale" value={fmtTHB(medianSale)} />
        <Stat
          label="Median rent"
          value={medianRent != null ? `${fmtTHB(medianRent)}/mo` : "—"}
        />
      </section>

      {rows.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
          No matches yet in this slice — coverage widens weekly. Try a
          neighbouring filter below, or browse the{" "}
          <Link
            href={`/${lang}/yields`}
            className="text-emerald-400 hover:underline"
          >
            full Thailand yield ranking
          </Link>
          .
        </div>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          <table className="w-full text-sm hidden sm:table">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-4 py-3">Condo</th>
                <th className="text-left px-4 py-3">District</th>
                <th className="text-right px-4 py-3">Yield</th>
                {mrr != null && <th className="text-right px-4 py-3">Spread</th>}
                <th className="text-right px-4 py-3">Sale</th>
                <th className="text-right px-4 py-3">Rent</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">FQ %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const y = r.gross_yield_pct ?? 0;
                const spread = mrr != null ? y - mrr : null;
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
                    <td className="px-4 py-3 text-zinc-400 capitalize">
                      {regionLabel(r)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {y.toFixed(2)}%
                    </td>
                    {mrr != null && (
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          spread != null && spread >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {spread != null
                          ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}pp`
                          : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(r.avg_sale_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(r.avg_monthly_rent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500 hidden md:table-cell">
                      {r.foreign_quota_inventory_pct != null
                        ? `${r.foreign_quota_inventory_pct.toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile stacked card list — same data, no horizontal scroll */}
          <ul className="sm:hidden divide-y divide-zinc-800/70">
            {rows.map((r, i) => {
              const y = r.gross_yield_pct ?? 0;
              const spread = mrr != null ? y - mrr : null;
              return (
                <li key={r.id} className="p-3">
                  <Link href={`/${lang}/condo/${r.slug ?? r.id}`} className="block space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-zinc-600 tabular-nums text-xs w-6 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-zinc-100 font-medium leading-snug">
                        {r.name}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 pl-8 flex-wrap text-xs">
                      <span className="text-zinc-400 capitalize">{regionLabel(r)}</span>
                      <span className="font-semibold tabular-nums text-base text-zinc-100">
                        {y.toFixed(2)}%
                      </span>
                      {spread != null && (
                        <span
                          className={`font-semibold tabular-nums ${
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
                      {r.foreign_quota_inventory_pct != null && (
                        <span>· FQ {r.foreign_quota_inventory_pct.toFixed(0)}%</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
        <p>
          Gross yield = (12 × median monthly rent) ÷ median sale price.
          Pre-tax, pre-vacancy. Net yield is typically 1.5–3pp lower after
          CAM, sinking fund, withholding, and vacancy. FQ % is the
          foreign-quota inventory share — the % of currently for-sale units
          a developer has flagged eligible for non-Thai ownership.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-200">
          Other {cityObj.display} slices
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {siblingSlugs.map((s) => (
            <Link
              key={s.slug}
              href={`/${lang}/best/${city}/${s.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {s.titleChunk(cityObj.display)}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-200">
          Same slice in other cities
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {siblingCities.map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/best/${c.slug}/${slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {filterObj.titleChunk(c.display)}
            </Link>
          ))}
        </div>
      </section>

      {/* Retiree Picks — only shown when city has scored data */}
      {retireeRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-200">
              🏥 Retiree-friendly picks in {cityObj.display}
            </h2>
            <Link
              href={`/${lang}/retiree/${city}`}
              className="text-xs text-emerald-400 hover:text-emerald-300 shrink-0"
            >
              Full ranked list →
            </Link>
          </div>
          <p className="text-xs text-zinc-500">
            Scored on healthcare access (40%), air quality (25%), transit (20%), daily errands (15%). Min score 55.
          </p>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            {retireeRows.map((r, i) => {
              const region = (Array.isArray(r.regions) ? r.regions[0] : r.regions)?.name;
              const score = r.retiree_score;
              const scoreColor = score >= 75 ? "text-emerald-400" : score >= 55 ? "text-emerald-300" : "text-zinc-400";
              return (
                <Link
                  key={r.id}
                  href={`/${lang}/condo/${r.slug ?? r.id}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/50 transition ${i > 0 ? "border-t border-zinc-800/50" : ""}`}
                >
                  <span className="text-zinc-600 tabular-nums text-xs w-5 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-zinc-100 font-medium text-sm leading-snug">{r.name}</span>
                  {region && <span className="text-zinc-500 text-xs hidden sm:block">{region}</span>}
                  <span className={`font-bold tabular-nums text-sm shrink-0 ${scoreColor}`}>{score}</span>
                </Link>
              );
            })}
          </div>
          <Link
            href={`/${lang}/blog/thailand-best-cities-for-retirees-2026`}
            className="block text-xs text-zinc-500 hover:text-zinc-300"
          >
            → Why we score healthcare at 40%: read the city comparison guide
          </Link>
        </section>
      )}

      <LeadCaptureCTA
        headline={`See one you like in ${cityObj.display}? Get an expert read.`}
      />

      <TravelAffiliateCard
        surface={`best-${city}-${slug}`}
        destination={cityObj.display}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
