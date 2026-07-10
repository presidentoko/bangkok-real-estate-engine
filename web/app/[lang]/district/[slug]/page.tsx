import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtTHB } from "@/lib/fmt";
import { isLang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

// ~183 districts x 3 langs = ~550 pages; data only refreshes weekly (see
// condo/[slug]/page.tsx for the full ISR-overage context from 2026-07-10).
export const revalidate = 604800;

type CondoLite = {
  id: string;
  slug: string | null;
  name: string;
  province: string | null;
  url: string | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  market_sale_median: number | null;
  market_rent_median: number | null;
  market_summary_currency: string | null;
};

// Slug → region.name lookup. Region names in DB are inconsistent
// (some 'bang-khen' lowercase, some 'Bang-khun-thian' capitalized) so we
// match case-insensitively, hyphens preserved.
async function resolveRegion(
  supabase: ReturnType<typeof getServerSupabase>,
  slug: string,
): Promise<{ id: string; name: string; province: string | null } | null> {
  // First try exact (cheap)
  const { data: exact } = await supabase
    .from("regions")
    .select("id, name, province")
    .eq("name", slug)
    .limit(1)
    .maybeSingle();
  if (exact) return exact as { id: string; name: string; province: string | null };

  // Then case-insensitive
  const { data: ilike } = await supabase
    .from("regions")
    .select("id, name, province")
    .ilike("name", slug)
    .limit(1)
    .maybeSingle();
  return (ilike as { id: string; name: string; province: string | null } | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const supabase = getServerSupabase();
  const region = await resolveRegion(supabase, slug);
  if (!region) return { title: "District — RealData" };
  const display = region.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const province = region.province ?? "Bangkok";
  const title = `${display} Condos, ${province.replace(/\b\w/g, (c) => c.toUpperCase())} — Yields, Prices & Flood Risk | RealData`;
  const description =
    `Every condo in ${display}, ${province}: gross rental ` +
    `yields ranked against Thai MRR, sale/rent medians, flood risk levels, ` +
    `and cross-portal price comparison. Independent data — no developer placement.`;
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/district/${slug}`,
      languages: langAlternates(`/district/${slug}`),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}/district/${slug}`,
      type: "website",
    },
  };
}

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();
  const region = await resolveRegion(supabase, slug);
  if (!region) notFound();

  const [{ data: condoRows }, mortgage] = await Promise.all([
    supabase
      .from("condos")
      .select(
        "id, slug, name, province, url, gross_yield_pct, avg_sale_price, " +
        "avg_monthly_rent, market_sale_median, market_rent_median, " +
        "market_summary_currency"
      )
      .eq("region_id", region.id)
      .eq("is_active", true)
      .range(0, 999),
    getCurrentMortgageRate(supabase),
  ]);

  const condos = (condoRows ?? []) as unknown as CondoLite[];
  if (condos.length === 0) notFound();

  // Aggregates
  const yieldsArr = condos
    .map((c) => c.gross_yield_pct)
    .filter((v): v is number => v != null && v > 0 && v < 30);
  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  };
  const medianYield = median(yieldsArr);
  const medianSale = median(
    condos.map((c) => c.avg_sale_price ?? c.market_sale_median).filter((v): v is number => !!v && v >= 500_000),
  );
  const medianRent = median(
    condos.map((c) => c.avg_monthly_rent ?? c.market_rent_median).filter((v): v is number => !!v && v >= 1_000),
  );
  const mrr = mortgage?.rate ?? null;

  const topYields = condos
    .filter((c) => c.gross_yield_pct != null && c.gross_yield_pct > 3 && c.gross_yield_pct < 25)
    .sort((a, b) => (b.gross_yield_pct ?? 0) - (a.gross_yield_pct ?? 0))
    .slice(0, 8);

  const display = region.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const provinceDisplay = (region.province ?? "Bangkok").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // JSON-LD Place schema for the district + ItemList of top condos.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${display}, ${provinceDisplay}`,
    description: `${condos.length} condos measured. Median yield ${medianYield != null ? medianYield.toFixed(2) + "%" : "—"}.`,
    containedInPlace: { "@type": "AdministrativeArea", name: provinceDisplay },
    url: `${SEO_SITE_URL}/${lang}/district/${slug}`,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Condos measured", value: condos.length },
      ...(medianYield != null
        ? [{ "@type": "PropertyValue", name: "Median gross yield (%)", value: +medianYield.toFixed(2) }]
        : []),
      ...(medianSale != null
        ? [{ "@type": "PropertyValue", name: "Median sale price (THB)", value: Math.round(medianSale) }]
        : []),
      ...(medianRent != null
        ? [{ "@type": "PropertyValue", name: "Median monthly rent (THB)", value: Math.round(medianRent) }]
        : []),
    ],
  };

  const spreadLine =
    medianYield != null && mrr != null
      ? `Median yield ${medianYield.toFixed(2)}% means a ${(medianYield - mrr >= 0 ? "+" : "")}${(medianYield - mrr).toFixed(2)}pp spread versus the current Thai MRR of ${mrr.toFixed(2)}%.`
      : medianYield != null
        ? `Median yield is ${medianYield.toFixed(2)}%.`
        : "Most buildings in this district don't have enough matched sale + rent listings yet to compute a yield.";

  const faqJsonLd = buildFaqJsonLd([
    {
      q: `How many condo buildings does RealData track in ${display}?`,
      a: `${condos.length} buildings across the ${display} district of ${provinceDisplay}, drawn from hipflat, dotproperty, ddproperty, and fazwaz listings.`,
    },
    {
      q: `What is the median gross rental yield in ${display}?`,
      a: spreadLine,
    },
    ...(medianSale != null
      ? [{
          q: `What is the median sale price for a condo in ${display}?`,
          a: `Median sale price is ฿${Math.round(medianSale).toLocaleString()} based on active listings across the four portals we track. Each individual condo page shows its own price evidence, including per-portal divergence where it exists.`,
        }]
      : []),
    ...(medianRent != null
      ? [{
          q: `What is the median monthly rent in ${display}?`,
          a: `Median monthly rent is ฿${Math.round(medianRent).toLocaleString()} per month for active listings in ${display}.`,
        }]
      : []),
    {
      q: `Is ${display} a good area for foreign buyers?`,
      a: `RealData doesn't editorialise — instead, the per-building pages surface the legally-binding signal: foreign-quota inventory share (the % of for-sale units in a building that are flagged Foreign Quota and therefore eligible for non-Thai ownership). Use the building list below to find condos with measured foreign-quota availability in ${display}.`,
    },
  ]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          District · {provinceDisplay}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold capitalize">{display}</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          {condos.length} condos in {display}, measured for yield, price, and
          flood risk. Independent data — no developer pay-for-placement.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Condos</div>
          <div className="text-3xl font-bold tabular-nums">{condos.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Median yield</div>
          <div className="text-3xl font-bold tabular-nums">
            {medianYield != null ? `${medianYield.toFixed(2)}%` : "—"}
          </div>
          {medianYield != null && mrr != null && (
            <div
              className={`text-xs mt-1 ${
                medianYield - mrr >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {medianYield - mrr >= 0 ? "+" : ""}
              {(medianYield - mrr).toFixed(2)}pp vs MRR
            </div>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Median sale</div>
          <div className="text-2xl font-bold tabular-nums">{fmtTHB(medianSale)}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Median rent</div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtTHB(medianRent)}
            {medianRent != null && <span className="text-sm text-zinc-500 font-normal"> /mo</span>}
          </div>
        </div>
      </section>

      {topYields.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Top yielding condos in {display}</h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3">Condo</th>
                  <th className="text-right px-4 py-3">Yield</th>
                  {mrr != null && <th className="text-right px-4 py-3">Spread</th>}
                  <th className="text-right px-4 py-3">Sale</th>
                  <th className="text-right px-4 py-3">Rent</th>
                </tr>
              </thead>
              <tbody>
                {topYields.map((c) => {
                  const y = c.gross_yield_pct!;
                  const spread = mrr != null ? y - mrr : null;
                  return (
                    <tr key={c.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/${lang}/condo/${c.slug ?? c.id}`}
                          className="text-zinc-100 hover:underline font-medium"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {y.toFixed(2)}%
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtTHB(c.avg_sale_price ?? c.market_sale_median)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtTHB(c.avg_monthly_rent ?? c.market_rent_median)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-semibold">All condos in {display}</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {condos
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${lang}/condo/${c.slug ?? c.id}`}
                  className="text-zinc-300 hover:text-emerald-400 hover:underline"
                >
                  {c.name}
                </Link>
                {c.gross_yield_pct != null && (
                  <span className="text-zinc-500 text-xs">
                    {" · "}{c.gross_yield_pct.toFixed(2)}%
                  </span>
                )}
              </li>
            ))}
        </ul>
      </section>

      <p className="text-xs text-zinc-500">
        Source: RealData measurement across hipflat, dotproperty, ddproperty,
        fazwaz · MRR benchmark from Bank of Thailand · last updated{" "}
        {new Date().toISOString().slice(0, 10)}.
      </p>
    </main>
  );
}
