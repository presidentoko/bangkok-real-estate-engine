import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { provinceDisplayName } from "@/lib/cities";
import { fmtTHB } from "@/lib/fmt";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { AdSlot } from "@/components/AdSlot";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

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
  published: boolean | null;
};

// Prebuild the districts with enough condos to matter (same >=3-condo bar
// sitemap-areas.xml uses to decide which /district/ URLs are worth
// publishing at all) x 3 langs. Slugs are encodeURIComponent(name.toLowerCase())
// to match the canonical URL this page and the sitemap both link to (see
// canonicalSlug below) — since resolveRegion() decodes before matching,
// prebuilt params round-trip correctly. Anything not in this prebuilt set
// (smaller districts, alternate casings) still renders fine via on-demand
// ISR — dynamicParams is left at its default `true`.
export async function generateStaticParams() {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("regions")
    .select("name, condos(id)")
    .limit(500);
  type RegionRow = { name: string; condos: { id: string }[] | null };
  const rows = (data ?? []) as RegionRow[];
  const slugs = rows
    .filter((r) => r.name && (r.condos ?? []).length >= 3)
    .map((r) => encodeURIComponent(r.name.toLowerCase()));
  return slugs.flatMap((slug) =>
    (["en", "ko", "th"] as const).map((lang) => ({ slug, lang }))
  );
}

/** The one URL form a district is allowed to be indexed under.
 *
 *  regions.name used to hold "Pathum Wan", "Pathum-wan" and "pathum-wan" as
 *  three separate rows, so the sitemap published both
 *  /district/pathum%20wan and /district/pathum-wan — two live 200s with
 *  identical content, each declaring itself canonical. Google reported the
 *  fallout as "Duplicate, Google chose different canonical" (393 pages) and
 *  "Alternate page with proper canonical" (1,219).
 *
 *  scripts/normalize_regions_and_provinces.py collapsed those rows onto the
 *  lowercase-hyphen spelling, which means the space and mixed-case forms
 *  Google already has indexed no longer match any region. This mirrors the
 *  same rule in the URL so those hits can be 301'd to the survivor instead
 *  of turning into ~180 fresh 404s. */
function canonicalDistrictSlug(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding from a crawler/scanner — not a district.
    return null;
  }
  return decoded.trim().toLowerCase().replace(/[\s_-]+/g, "-");
}

// Canonical slug → region lookup. Every regions.name is now the
// lowercase-hyphen form (enforced on write by src/db.canonical_region_name
// and backfilled by scripts/normalize_regions_and_provinces.py), so this is
// a single exact match — the old two-query exact-then-ilike dance existed
// only to cope with the mixed casings that migration removed. Wrapped in
// React's cache() so generateMetadata() and the page body share one Supabase
// round trip per request (same pattern as condo/[slug]/page.tsx's
// getCondoIdBySlug).
const resolveRegion = cache(async (
  canonicalSlug: string,
): Promise<{ id: string; name: string; province: string | null } | null> => {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("regions")
    .select("id, name, province")
    .eq("name", canonicalSlug)
    .limit(1)
    .maybeSingle();
  return (data as { id: string; name: string; province: string | null } | null) ?? null;
});

/** Resolve the route param to a region, or 404.
 *
 *  Non-canonical spellings (/district/pathum%20wan, /district/Pathum-Wan)
 *  are 308'd to the canonical form by middleware.ts, NOT here. A
 *  permanentRedirect() thrown from this route cannot produce a real 3xx:
 *  the page is ISR (revalidate = 604800), so Next has already begun
 *  streaming the shell by the time the redirect throws and it degrades into
 *  a client-side redirect inside a 200 — verified locally, the response was
 *  a 200 with an empty suspended body. Middleware runs before any rendering
 *  and issues an actual 308, which is what a crawler needs.
 *
 *  Still called from generateMetadata() AND the page body, for the reason
 *  spelled out in condo/[slug]/page.tsx: metadata runs first and fixes the
 *  response's cache envelope, so a 404 decided only in the body ships too
 *  late. resolveRegion is cached per request, so the second call is free. */
/** Districts below this render, but ask not to be indexed. Matches the
 *  >=3-condo bar sitemap-areas.xml uses to decide what to publish. */
const MIN_CONDOS_TO_INDEX = 3;

/** Linkable (published + active) condo count for a district. A district
 *  whose buildings all have unreachable detail pages has nothing to rank
 *  with, so it renders but does not ask to be indexed — 54 of the 153
 *  populated districts are in that state today, all of them in provinces
 *  with no city page yet. cache()'d because generateMetadata decides
 *  robots from it before the body runs its own (wider) query. */
const countPublishedCondos = cache(async (regionId: string): Promise<number> => {
  const supabase = getServerSupabase();
  const { count } = await supabase
    .from("condos")
    .select("id", { count: "exact", head: true })
    .eq("region_id", regionId)
    .eq("is_active", true)
    .eq("published", true);
  return count ?? 0;
});

async function resolveOrNotFound(rawSlug: string) {
  const canonical = canonicalDistrictSlug(rawSlug);
  if (!canonical) notFound();
  const region = await resolveRegion(canonical);
  if (!region) notFound();
  return region;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const region = await resolveOrNotFound(slug);
  const display = region.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  // generateMetadata's `lang` is still an unvalidated route param here (the
  // page body narrows it via isLang below), so guard before passing it on.
  const safeLang = isLang(lang) ? lang : "en";
  const province = provinceDisplayName(region.province ?? "bangkok", safeLang);
  const t = getDictionary(safeLang);
  const title = t.seo.districtTitle(display, province);
  const description = t.seo.districtDesc(display, province);
  // region.name IS the canonical slug now (see resolveRegion). Kept as a
  // named local because it appears in the canonical, the hreflang set, the
  // OG url and the breadcrumb, and those must not drift apart.
  const canonicalSlug = region.name;
  // Thin-district gate. sitemap-areas.xml has always required >=3 condos
  // before publishing a /district/ URL, but on-demand ISR renders any
  // district that resolves — so a two-building district reached from a
  // condo page's breadcrumb was still a 200 asking to be indexed, with
  // nothing on it but two links. Same reasoning as the per-condo gate in
  // lib/condoIndexability.ts: keep it live, keep it crawlable, stop asking
  // for a ranking. `follow` so the condo links still pass equity.
  const publishedCount = await countPublishedCondos(region.id);
  return {
    title,
    description,
    ...(publishedCount >= MIN_CONDOS_TO_INDEX
      ? {}
      : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/district/${canonicalSlug}`,
      languages: langAlternates(`/district/${canonicalSlug}`),
    },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}/district/${canonicalSlug}` }),
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
  const region = await resolveOrNotFound(slug);
  const t = getDictionary(lang);
  const d = t.districtPage;

  const [{ data: condoRows }, mortgage] = await Promise.all([
    supabase
      .from("condos")
      .select(
        "id, slug, name, province, url, gross_yield_pct, avg_sale_price, " +
        "avg_monthly_rent, market_sale_median, market_rent_median, " +
        "market_summary_currency, published"
      )
      .eq("region_id", region.id)
      .eq("is_active", true)
      .order("id")
      .range(0, 999),
    getCurrentMortgageRate(),
  ]);

  const condos = (condoRows ?? []) as unknown as CondoLite[];
  if (condos.length === 0) notFound();

  // Only published buildings have a reachable /condo/ page: the detail
  // route reads condos_published, so an unpublished slug renders the
  // not-found boundary. Linking to those was the bug — 870 condos across
  // 25 provinces with no city page, every link dead (same class as the one
  // fixed in lib/queries/yield.ts, a2fc90e).
  //
  // The aggregates above still use every active building, published or
  // not: the measurement is real either way, and dropping it would make
  // Mueang Nonthaburi's median price wrong rather than merely unlinked.
  const linkable = condos.filter((c) => c.published && c.slug);

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

  const topYields = linkable
    .filter((c) => c.gross_yield_pct != null && c.gross_yield_pct > 3 && c.gross_yield_pct < 25)
    .sort((a, b) => (b.gross_yield_pct ?? 0) - (a.gross_yield_pct ?? 0))
    .slice(0, 8);

  const display = region.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const provinceDisplay = provinceDisplayName(region.province ?? "bangkok", lang);
  // Same lowercase-canonical rule as generateMetadata above — self-referential
  // URLs in structured data should match the canonical, not the raw param.
  const canonicalSlug = encodeURIComponent(region.name.toLowerCase());

  // JSON-LD Place schema for the district + ItemList of top condos.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${display}, ${provinceDisplay}`,
    description: `${condos.length} condos measured. Median yield ${medianYield != null ? medianYield.toFixed(2) + "%" : "—"}.`,
    containedInPlace: { "@type": "AdministrativeArea", name: provinceDisplay },
    url: `${SEO_SITE_URL}/${lang}/district/${canonicalSlug}`,
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
      ? d.faqSpread(
          medianYield.toFixed(2),
          `${medianYield - mrr >= 0 ? "+" : ""}${(medianYield - mrr).toFixed(2)}`,
          mrr.toFixed(2),
        )
      : medianYield != null
        ? d.faqYieldOnly(medianYield.toFixed(2))
        : d.faqNoYield;

  // Every string in this block used to be an English literal, on all three
  // locales. /ko and /th therefore shipped a Korean/Thai <title> over an
  // entirely English body, which is what Google reports as "Duplicate,
  // Google chose different canonical than user" (375 URLs on 2026-08-17):
  // three URLs, one set of words, so it keeps one and drops two.
  const faqItems = [
    { q: d.faqCount(display), a: d.faqCountA(condos.length, display, provinceDisplay) },
    { q: d.faqYield(display), a: spreadLine },
    ...(medianSale != null
      ? [{ q: d.faqSale(display), a: d.faqSaleA(`฿${Math.round(medianSale).toLocaleString()}`) }]
      : []),
    ...(medianRent != null
      ? [{ q: d.faqRent(display), a: d.faqRentA(`฿${Math.round(medianRent).toLocaleString()}`, display) }]
      : []),
    { q: d.faqForeign(display), a: d.faqForeignA(display) },
  ];
  const faqJsonLd = buildFaqJsonLd(faqItems);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: "RealData", href: `/${lang}` },
          { name: t.districtsIndex.title, href: `/${lang}/districts` },
          { name: display, href: `/${lang}/district/${canonicalSlug}` },
        ]}
      />

      <header className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          {d.eyebrow(provinceDisplay)}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold capitalize">{display}</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          {d.intro(condos.length, display)}
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{d.statCondos}</div>
          <div className="text-3xl font-bold tabular-nums">{condos.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{d.statMedianYield}</div>
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
              {(medianYield - mrr).toFixed(2)}pp {d.vsMrr}
            </div>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{d.statMedianSale}</div>
          <div className="text-2xl font-bold tabular-nums">{fmtTHB(medianSale)}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{d.statMedianRent}</div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtTHB(medianRent)}
            {medianRent != null && (
              <span className="text-sm text-zinc-500 font-normal"> {d.perMonth}</span>
            )}
          </div>
        </div>
      </section>

      {topYields.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{d.topYieldTitle(display)}</h2>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3">{d.thCondo}</th>
                  <th className="text-right px-4 py-3">{d.thYield}</th>
                  {mrr != null && <th className="text-right px-4 py-3">{d.thSpread}</th>}
                  <th className="text-right px-4 py-3">{d.thSale}</th>
                  <th className="text-right px-4 py-3">{d.thRent}</th>
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
                          href={`/${lang}/condo/${c.slug}`}
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

      {linkable.length > 0 && (
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-base font-semibold">{d.allCondosTitle(display)}</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {linkable
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${lang}/condo/${c.slug}`}
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
      )}

      <AdSlot name="hubBelow" />

      <FaqSection items={faqItems} heading={t.home.faqTitle} />

      <LeadCaptureCTA headline={d.ctaHeadline(display)} />

      <p className="text-xs text-zinc-500">{d.source}</p>
    </main>
  );
}
