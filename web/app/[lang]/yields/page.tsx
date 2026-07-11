import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { YieldsExplorer } from "@/components/YieldsExplorer";
import { isLang } from "@/lib/i18n";
import { fetchYieldRows, getCurrentMortgageRate } from "@/lib/queries/yield";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

// Static shell — no searchParams read here. Reading searchParams server-side
// silently opts the whole route out of ISR (every request becomes a live
// Function invocation), which was true for this page and 3 others before
// 2026-07-11. The default ranking renders statically at build/regen time;
// YieldsExplorer (client) reads ?province/?sort/?min_yield after hydration
// and fetches filtered rows from /api/yields. See lib/yields.ts + that route.
export const revalidate = 86400;

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

export default async function YieldsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();
  const [rows, mortgage] = await Promise.all([
    fetchYieldRows(supabase),
    getCurrentMortgageRate(supabase),
  ]);
  const mrr = mortgage?.rate ?? null;

  // JSON-LD ItemList so AI Overviews can quote the ranking as a list result.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Top rental-yield condos in Thailand",
    description: "Condos ranked by gross rental yield, with MRR mortgage spread context.",
    itemListElement: rows.slice(0, 25).map((r, i) => ({
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

      <YieldsExplorer lang={lang} initialRows={rows} mrr={mrr} />

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
