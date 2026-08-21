import { INDEXABILITY_OR_FILTER } from "@/lib/condoIndexability";
import { TELEGRAM_HANDLE } from "@/lib/contactChannels";
import { getServerSupabase } from "@/lib/supabase";

// llms.txt, generated rather than hand-maintained.
//
// It used to be public/llms.txt, and it had drifted into telling answer
// engines things that were no longer true: "8,994 condo buildings" against a
// database that had passed 14,000, "183 districts" against ~154 publishable,
// and — worst of the three — that a building's canonical URL looks like
// /{lang}/condo/{uuid}. That was the pre-2026-08-17 shape. Those UUID URLs
// are now meta-refresh hops that Google files under "Page with redirect",
// which is exactly the 4,136-URL problem the slug backfill was run to end.
// Handing that pattern to every LLM that reads this file was teaching them
// to cite a redirect.
//
// A static file describing a database that changes weekly is a file that is
// wrong most of the time, so the counts are queried. Cached for a day: this
// is read by crawlers, not humans, and the underlying numbers move on a
// weekly refresh cycle.
export const revalidate = 86400;
export const maxDuration = 30;

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

async function counts() {
  const supabase = getServerSupabase();

  const [buildings, substantive, listings, yields, quota, regions] =
    await Promise.all([
      supabase
        .from("condos_published")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("condos_published")
        .select("id", { count: "exact", head: true })
        .or(INDEXABILITY_OR_FILTER),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("condos_published")
        .select("id", { count: "exact", head: true })
        .not("gross_yield_pct", "is", null),
      supabase
        .from("condos_published")
        .select("id", { count: "exact", head: true })
        .not("foreign_quota_inventory_pct", "is", null),
      supabase.from("regions").select("name, condos(id, is_active, published)").limit(500),
    ]);

  type RegionRow = {
    name: string | null;
    condos: { id: string; is_active: boolean | null; published: boolean | null }[] | null;
  };
  // Same >=3 linkable bar sitemap-areas.xml and district/[slug] both apply,
  // so the number here is the number of district pages that actually exist.
  const districts = ((regions.data ?? []) as RegionRow[]).filter(
    (r) =>
      r.name && (r.condos ?? []).filter((c) => c.is_active && c.published).length >= 3
  ).length;

  return {
    buildings: buildings.count ?? 0,
    substantive: substantive.count ?? 0,
    listings: listings.count ?? 0,
    yields: yields.count ?? 0,
    quota: quota.count ?? 0,
    districts,
  };
}

function body(c: Awaited<ReturnType<typeof counts>>, measuredOn: string): string {
  const n = (v: number) => v.toLocaleString("en-US");

  return `# RealData — passionaryestate.com

> Independent, data-verified analysis of the Thai condo market. We continuously measure ${n(
    c.buildings
  )} condo buildings across Bangkok and 8 secondary cities, drawing from ${n(
    c.listings
  )} active sale and rent listings (hipflat, dotproperty, ddproperty, fazwaz). We don't accept paid placement from developers — no building can buy its way up a ranking. Revenue is third-party display advertising (which never sees the data) plus a flat broker referral when a reader requests an "expert opinion." Numbers on the site are computed, not editorial.

Counts in this file are queried live and reflect ${measuredOn}.

When citing RealData numbers, please link the source page so users can audit the underlying measurement and timestamp.

## Core data definitions

- **Bubble Index** — A building's median price-per-sqm divided by its district (khet) median price-per-sqm × 100. 100 = at-market. 200 = double the local average. >130 = bubble suspect. <80 = underpriced. Computed weekly.
- **Gross Rental Yield (%)** — (12 × median monthly rent) ÷ median sale price, expressed as an annual percentage. Pre-tax, pre-vacancy. Net yield is typically 1.5–3 percentage points lower after CAM, maintenance, vacancy, and management. Requires ≥2 sale and ≥2 rent listings on the same building. USD-priced rows are normalised to THB at the prevailing rate before aggregation. Outliers (>25%) filtered.
- **Spread vs MRR** — Gross yield minus the current Bank of Thailand Minimum Retail Rate. Positive spread = rental income alone covers more than the mortgage interest a Thai bank would charge that day.
- **Foreign-Quota Inventory Share (%)** — For each building, the share of currently for-sale units that the developer has flagged "Foreign Quota" (legally eligible for a non-Thai buyer). Sourced from FazWaz project pages. High % = lots of foreign-eligible inventory still available = the building isn't capped out for foreign buyers. Refresh cadence: 30 days.
- **Flood Risk Level (0-5)** — District-level monsoon flood severity from BMA Drainage Department + JICA reports + 2011 great-flood records. 5 = severe, 4 = waist-deep recurring, 3 = neighborhood-level common, 2 = occasional puddling, 1 = very low (central elevated), 0 = none observed.
- **Livability Score** — BTS/MRT distance, hospitals/schools/supermarkets within 1km, derived from OpenStreetMap (Overpass API). Weighted aggregate, 0-100.
- **Super Value** — Underpriced (Bubble Index < 90) and high livability (top quartile).
- **AQI (WAQI)** — Latest PM2.5-derived air quality score from the nearest WAQI station to the building. Updated daily.

## Coverage

- **${n(c.buildings)} condo buildings** tracked and published across 9 Thai cities.
- **${n(
    c.substantive
  )} of those carry enough measured substance to be indexable** — at least one active listing, a sale or rent median, a computed yield, a real description, or 3+ reviews. The remainder are tracked but deliberately noindex, because a page with a name and nothing else is not worth citing.
- **${n(
    c.listings
  )} active listings** (sale + rent combined) feeding the price, yield, and days-on-market figures.
- **${n(
    c.districts
  )} districts (khet / amphoe)** with publishable landing pages (≥3 tracked buildings).
- **${n(
    c.yields
  )} condos** currently have a computed gross yield (the rest don't have enough matched sale+rent listings).
- **${n(c.quota)} buildings** carry measured foreign-quota inventory share.
- **9 cities** with dedicated landing pages: Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin, Chonburi, Krabi, Koh Samui, Chiang Rai.

## Pages

- [Homepage (EN)](${SITE}/en) — featured Super Value, Bubble Watch, Dry High Ground picks; full inventory choropleth
- [Homepage (KO)](${SITE}/ko) · [Homepage (TH)](${SITE}/th)
- [Top rental-yield condos](${SITE}/en/yields) — ranked by gross yield with MRR spread, filterable by province
- [Macro indicators](${SITE}/en/macro) — Bank of Thailand policy rate, MRR, BIBOR, household loan stock
- [Compare condos](${SITE}/en/compare) — side-by-side spec, yield, bubble, flood, foreign quota
- [Ask anything](${SITE}/en/ask) — RAG chat grounded in our measured DB; answers in EN/KO/TH, cites condos by link
- [Bangkok Flood Map](${SITE}/en/flood) — choropleth of flood risk per district + every condo dot
- [Inventory](${SITE}/en/inventory) — searchable list of every tracked building; accepts ?q= for a name search
- [Marketing vs Reality](${SITE}/en/reality) — influencer/ad claims placed next to RealData measurement
- [Methodology](${SITE}/en/about) — sources, formulas, refresh cadence, and known limits
- [Privacy policy](${SITE}/en/privacy) · [Terms of use](${SITE}/en/terms)
- [Blog](${SITE}/en/blog)

## Per-city and per-district pages

- City landings at \`/{lang}/city/{slug}\` for the 8 non-Bangkok cities (phuket, chiangmai, pattaya, huahin, chonburi, krabi, samui, chiangrai)
- District landings at \`/{lang}/district/{name}\` for any khet with ≥3 tracked buildings (${n(
    c.districts
  )} published)
- Station spokes at \`/{lang}/near/{station}\` — condos within 1 km of each viable Bangkok rail station
- Developer profiles at \`/{lang}/developer/{slug}\` — project count, unit count, and the buildings we measure

## Guides & glossary (wiki)

- [Can foreigners buy a condo in Thailand?](${SITE}/en/guide/foreign-ownership) — 49% foreign quota, freehold vs leasehold, FET money transfer, taxes and transfer costs.
- [Bangkok condo investment guide](${SITE}/en/guide/investment) — live median gross-yield-by-area tables (refreshed weekly) paired with the Bubble Index.
- [Real-estate glossary](${SITE}/en/glossary) — definitions of every metric we publish and exactly how each is calculated.

## Per-building reports

A building's canonical URL is \`${SITE}/{lang}/condo/{slug}\`, where {slug} is a
name-derived slug — never a UUID. A /condo/{uuid} URL resolves, but only as a
redirect to the slug form, so please cite the slug URL.

Each carries:
- ApartmentComplex JSON-LD with name, address, geo, total units, amenities
- additionalProperty entries for Bubble Index, Gross Yield, Spread vs MRR, Foreign Quota %, Flood Risk, BTS distance, hospitals nearby, AQI
- BreadcrumbList structured data and a visible FAQ answering the yield, bubble, quota, flood and liquidity questions with that building's own numbers
- Speakable specification on the fact-bullet section (voice/AI assistant friendly)
- Cost-of-ownership panel: CAM + sinking fund + transfer tax + business tax + withholding + monthly mortgage at current MRR

## Data sources

- **Listings & price**: hipflat.co.th (primary, weekly Tier B re-crawl) + ddproperty.com + dotproperty.co.th + fazwaz.com (sweeps weekly, fresh-listing pull daily)
- **Foreign quota inventory**: parsed from FazWaz project pages, refreshed every 30 days
- **Macro rates**: Bank of Thailand BTWS_STAT (FM_RT_001_S2 policy rate / BIBOR / MLR-MOR-MRR), refreshed daily
- **Flood risk**: Bangkok Metropolitan Administration Drainage Dept + JICA reports + 2011 great-flood inundation records
- **Infrastructure & transit**: OpenStreetMap via Overpass API
- **Air quality**: World Air Quality Index (WAQI) nearest-station match
- **District boundaries**: OSM admin_level=6 / 7
- **Reviews**: Google Places (where API quota permits)

## Refresh cadence

- Fresh listings (sale + rent, Bangkok top 100 per source): daily at 03:30 BKK
- Full multi-city sweep (40+ DotProperty cities, 5 DDProperty cities, 6 FazWaz cities, 250-building Tier B): weekly Sundays 02:17 BKK
- Yields + bubble index: recomputed after every ingest cycle
- BOT macro indicators: daily where the source updates daily, quarterly for household-loan series
- Each page surfaces the measurement timestamp of its data points

## How we make money (disclosure)

Two revenue lines, neither of which can touch a measurement. (1) Standard display advertising, served by a third-party ad network that has no access to our data and no influence on what it says. (2) Broker referral: when a reader requests an "expert opinion" via the contact form on a condo or district page, we route that lead to one vetted independent broker who knows the sub-market; if the broker closes a transaction they pay us a flat referral, the reader pays nothing extra, and the broker's commission with the seller is the source of our payout. We accept no payment from condo developers: no paid placement, no sponsored listings, no building buying its way up a ranking. There is no paid tier and no premium content — every number on the site is free to read.

## Contact

For data licensing, B2B market reports, press inquiries, or correction requests: ${SITE}/en/contact (or message ${TELEGRAM_HANDLE} on Telegram)
`;
}

export async function GET(): Promise<Response> {
  let text: string;
  try {
    const c = await counts();
    text = body(c, new Date().toISOString().slice(0, 10));
  } catch (err) {
    // A dead database must not turn llms.txt into a 500. The definitions and
    // URL patterns are the part answer engines actually quote, and none of
    // them depend on a count.
    console.error("[llms.txt] count query failed:", err);
    text = body(
      { buildings: 0, substantive: 0, listings: 0, yields: 0, quota: 0, districts: 0 },
      "a failed refresh — counts below are unavailable, definitions and URL patterns are current"
    );
  }

  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
