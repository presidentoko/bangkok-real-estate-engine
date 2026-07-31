import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLang } from "@/lib/i18n";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

export const revalidate = 86400;

// Indicators we surface at the top of the page (concise, decision-relevant set).
const FEATURED: Array<{ name: string; label: string; series: string }> = [
  { name: "Policy Rate",                              label: "Policy rate",         series: "FM_RT_001_S2" },
  { name: "MRR (Minimum Retail Rate) Min",            label: "MRR — min",            series: "FM_RT_001_S2" },
  { name: "MRR (Minimum Retail Rate) Max",            label: "MRR — max",            series: "FM_RT_001_S2" },
  { name: "MLR (Minimum Lending Rate) : Min",         label: "MLR — min",            series: "FM_RT_001_S2" },
  { name: "MOR (Minimum Overdraft Rate) : Min",       label: "MOR — min",            series: "FM_RT_001_S2" },
  { name: "Savings deposits : Max",                   label: "Savings deposit max",  series: "FM_RT_001_S2" },
];

type MacroRow = {
  source: string;
  series_code: string;
  indicator_name: string;
  period: string;
  value: number;
  is_provisional: boolean;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Macro — RealData" };
  const title = "Thailand mortgage + macro rates (BOT data) — RealData";
  const description =
    "Bank of Thailand benchmark rates: Policy Rate, MRR, MLR, MOR, household debt. " +
    "The macro backdrop every Thai condo buyer needs before signing a loan.";
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/macro`,
      languages: langAlternates("/macro"),
    },
    openGraph: { title, description, url: `${SEO_SITE_URL}/${lang}/macro`, type: "website" },
  };
}

export default async function MacroPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();

  // Pull all featured indicators (one row per period within recent window).
  const { data } = await supabase
    .from("macro_indicators")
    .select("source, series_code, indicator_name, period, value, is_provisional")
    .eq("source", "bot")
    .in(
      "indicator_name",
      FEATURED.map((f) => f.name),
    )
    .order("period", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as MacroRow[];

  // Build {indicator → [{period, value}], sorted desc by period}.
  const byIndicator = new Map<string, MacroRow[]>();
  for (const r of rows) {
    const list = byIndicator.get(r.indicator_name) ?? [];
    list.push(r);
    byIndicator.set(r.indicator_name, list);
  }

  // Latest period across the data — used to label "as of".
  const latestPeriod = rows.length > 0 ? rows[0].period : null;

  // JSON-LD Dataset schema — helps AI Overviews / Perplexity quote our
  // page as "structured data from BOT". The temporal coverage + creator
  // attribution makes it cite-worthy.
  const periodYears = Array.from(new Set(rows.map((r) => r.period.slice(0, 4))));
  const minYear = periodYears.length ? periodYears.reduce((a, b) => (a < b ? a : b)) : null;
  const maxYear = periodYears.length ? periodYears.reduce((a, b) => (a > b ? a : b)) : null;
  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Thailand mortgage + macro rates",
    description:
      "Bank of Thailand benchmark rates (Policy, MRR, MLR, MOR, deposit) sourced " +
      "from BTWS_STAT and surfaced per-condo alongside RealData yield measurements.",
    creator: { "@type": "Organization", name: "Bank of Thailand", url: "https://www.bot.or.th/" },
    publisher: { "@type": "Organization", name: "RealData", url: SEO_SITE_URL },
    license: "https://www.bot.or.th/en/about-us/conditions-of-use.html",
    spatialCoverage: { "@type": "Country", name: "Thailand" },
    temporalCoverage: minYear && maxYear ? `${minYear}/${maxYear}` : undefined,
    keywords: [
      "Thailand mortgage rate", "MRR", "MLR", "MOR", "Policy rate",
      "Bank of Thailand", "BOT", "household debt", "real estate macro",
    ],
    variableMeasured: FEATURED.map((f) => ({
      "@type": "PropertyValue",
      name: f.label,
      description: f.name,
    })),
    url: `${SEO_SITE_URL}/${lang}/macro`,
    isAccessibleForFree: true,
  };

  // Format the latest MRR-min value into the FAQ where possible so the
  // structured answer carries a concrete current number, not a generic.
  const latestMrrMin = (byIndicator.get("MRR (Minimum Retail Rate) Min") ?? [])[0];
  const mrrLine = latestMrrMin
    ? `As of ${latestMrrMin.period.slice(0, 7)}, MRR-min stood at ${latestMrrMin.value.toFixed(2)}%.`
    : "";

  const faqJsonLd = buildFaqJsonLd([
    {
      q: "What is Thailand's MRR and why does it matter for condo buyers?",
      a: `MRR (Minimum Retail Rate) is the reference rate Thai banks attach mortgage products to — e.g. "MRR-1.5% for the first three years, MRR floating after." It is the single most important rate for a Thai home buyer because every floating-rate mortgage moves with it. ${mrrLine} The Bank of Thailand publishes it daily on the BTWS_STAT portal.`,
    },
    {
      q: "What is the difference between Policy Rate, MRR, MLR, and MOR?",
      a: "Policy Rate is the BOT's overnight repurchase rate and sets the floor for everything else. MLR (Minimum Lending Rate) is for prime corporate and high-quality retail borrowers and sits below MRR. MRR (Minimum Retail Rate) is the standard reference for retail mortgages. MOR (Minimum Overdraft Rate) governs overdraft facilities and is less relevant for property but tracks broader lending conditions.",
    },
    {
      q: "How often does RealData refresh these macro numbers?",
      a: "Daily, where the Bank of Thailand publishes daily — Policy Rate, MRR, MLR, MOR, BIBOR. The household-loan stock series is quarterly. Each card on this page shows its own latest period.",
    },
    {
      q: "Where does this data come from?",
      a: "Bank of Thailand BTWS_STAT (series FM_RT_001_S2 for the interest-rate panel and EC_MB_039 for the household-loan series). Free to use under the BOT's standard data conditions; we link the source for every quoted number.",
    },
    {
      q: "How do I use MRR to judge whether a condo yield is attractive?",
      a: "Compute spread = condo's gross rental yield - MRR. Positive spread means the rental income alone covers more than the mortgage interest a Thai bank would charge that day on a fully-leveraged purchase. We compute this spread for every condo with enough data on the /yields ranking and on each individual condo report.",
    },
  ]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(datasetJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Thailand mortgage + macro rates</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          Source: Bank of Thailand BTWS_STAT (FM_RT_001_S2). Updated weekly.
          {latestPeriod && (
            <>
              {" "}Most recent point: <strong className="text-zinc-200">{latestPeriod.slice(0, 7)}</strong>.
            </>
          )}
        </p>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURED.map((f) => {
          const series = byIndicator.get(f.name) ?? [];
          const latest = series[0];
          const prev = series.find((r) => r.period !== latest?.period);
          const delta = latest && prev ? latest.value - prev.value : null;
          const arrow =
            delta == null ? "" : delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
          const deltaColor =
            delta == null ? "text-zinc-500" : delta > 0 ? "text-rose-400" : delta < 0 ? "text-emerald-400" : "text-zinc-400";
          return (
            <div key={f.name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                {f.label}
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-bold tabular-nums">
                  {latest ? latest.value.toFixed(2) : "—"}
                  {latest && <span className="text-base text-zinc-500 ml-1">%</span>}
                </div>
                {delta != null && (
                  <div className={`text-xs tabular-nums ${deltaColor}`}>
                    {arrow} {Math.abs(delta).toFixed(2)}pp
                  </div>
                )}
              </div>
              {latest && (
                <div className="text-zinc-500 text-xs mt-1">
                  {latest.period.slice(0, 7)}
                  {latest.is_provisional && " · provisional"}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          How to read these rates
        </h2>
        <dl className="text-sm text-zinc-400 space-y-2 leading-relaxed">
          <div>
            <dt className="text-zinc-200 font-medium inline">Policy Rate.</dt>{" "}
            <dd className="inline">
              The BOT&apos;s overnight repurchase rate. Sets the floor for
              everything else.
            </dd>
          </div>
          <div>
            <dt className="text-zinc-200 font-medium inline">MRR (Minimum Retail Rate).</dt>{" "}
            <dd className="inline">
              The reference rate Thai banks attach mortgage products to (e.g.
              &quot;MRR&minus;1.5% for first 3 years&quot;). The one to watch
              for home buyers.
            </dd>
          </div>
          <div>
            <dt className="text-zinc-200 font-medium inline">MLR (Minimum Lending Rate).</dt>{" "}
            <dd className="inline">
              Usually for prime corporate / high-quality retail. Below MRR.
            </dd>
          </div>
          <div>
            <dt className="text-zinc-200 font-medium inline">MOR (Minimum Overdraft Rate).</dt>{" "}
            <dd className="inline">
              Overdraft facilities. Less relevant for property but tracks
              broader lending conditions.
            </dd>
          </div>
        </dl>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">
          Why this matters for condo buyers
        </h2>
        <p className="text-zinc-400 text-sm leading-relaxed">
          A condo&apos;s gross rental yield only matters relative to the cost
          of borrowed money. If MRR is 7.10% and your condo earns 6% gross
          yield, the rental income alone won&apos;t cover the interest on a
          fully-leveraged purchase. We compute this spread per building on the{" "}
          <a className="text-emerald-400 hover:underline" href={`/${lang}/yields`}>
            yields ranking
          </a>{" "}
          and every individual condo report.
        </p>
      </section>
    </main>
  );
}
