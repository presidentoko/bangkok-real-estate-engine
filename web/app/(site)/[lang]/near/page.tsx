import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { isLang, LANGS } from "@/lib/i18n";
import { getStationNetworks, getViableStations } from "@/lib/queries/stations";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

// The station index. Added 2026-08-21 for the same reason /districts exists:
// sitemap-areas.xml publishes a /near/<station> URL for every viable station
// (~100 of them x 3 langs), but the ONLY inbound link to any of them is from
// individual condo detail pages. Those are 503'd for most crawlers by the
// hosting-budget throttle in middleware.ts until 2026-09-13 and ~70% of them
// are noindex, so in practice the station pages are orphans: in the sitemap,
// with no crawlable path in. This page is that path.
//
// Everything here comes from getViableStations() — the same function
// sitemap-areas.xml and near/[station]'s generateStaticParams/dynamicParams
// use — so the index, the sitemap and the set of routes that actually exist
// can never disagree about which stations are real.
export const revalidate = 604800;

type Group = {
  key: string;
  heading: string;
  blurb: string;
  stations: Array<{ slug: string; name: string; condoCount: number }>;
};

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

const SEO_TITLE = "Condos Near Every BTS & MRT Station in Bangkok | RealData";
const SEO_DESC =
  "Every Bangkok BTS Skytrain and MRT station with condo buildings within 1 km — condo counts, median price per sqm and gross yield per station. Independent data, no developer sponsorships.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: SEO_TITLE,
    description: SEO_DESC,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/near`,
      languages: langAlternates("/near"),
    },
    openGraph: ogFor(lang, {
      title: SEO_TITLE,
      description: SEO_DESC,
      url: `${SEO_SITE_URL}/${lang}/near`,
    }),
  };
}

export default async function StationIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const [stations, networks] = await Promise.all([
    getViableStations(),
    getStationNetworks().catch(() => ({}) as Record<string, { bts: boolean; mrt: boolean }>),
  ]);

  // Group by network rather than dumping ~100 stations in one list. A reader
  // who commutes on the Skytrain does not want the Blue Line interleaved.
  const buckets: Record<"both" | "bts" | "mrt" | "other", Group["stations"]> = {
    both: [],
    bts: [],
    mrt: [],
    other: [],
  };
  for (const s of stations) {
    const n = networks[s.slug];
    if (n?.bts && n?.mrt) buckets.both.push(s);
    else if (n?.bts) buckets.bts.push(s);
    else if (n?.mrt) buckets.mrt.push(s);
    else buckets.other.push(s);
  }

  const groups: Group[] = [
    {
      key: "both",
      heading: "Interchange stations (BTS + MRT)",
      blurb: "Served by both networks — the shortest commute times in the city.",
      stations: buckets.both,
    },
    {
      key: "bts",
      heading: "BTS Skytrain",
      blurb: "Sukhumvit and Silom line stations with condo buildings within 1 km.",
      stations: buckets.bts,
    },
    {
      key: "mrt",
      heading: "MRT",
      blurb: "Blue and Purple line metro stations with condo buildings within 1 km.",
      stations: buckets.mrt,
    },
    {
      key: "other",
      heading: "Other stations",
      blurb: "Stations we have condo coverage for but no confirmed network label.",
      stations: buckets.other,
    },
  ].filter((g) => g.stations.length > 0);

  // ItemList so an answer engine asked "which BTS station has the most
  // condos" can read the ranking without parsing the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: SEO_TITLE,
    numberOfItems: stations.length,
    itemListElement: stations.slice(0, 100).map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `${SEO_SITE_URL}/${lang}/near/${s.slug}`,
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { name: "RealData", href: `/${lang}` },
          { name: "Stations", href: `/${lang}/near` },
        ]}
      />

      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold">Condos by BTS &amp; MRT station</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Every station with at least five condo buildings inside a 1 km walk. Each
          station page lists those buildings with median price per sqm, gross yield
          and flood risk.
        </p>
        <p className="text-zinc-500 text-xs">
          {stations.length} stations covered
        </p>
      </header>

      {stations.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-3">
          <p className="text-zinc-400 text-sm">
            Station coverage is being rebuilt — no station currently clears the
            five-building bar.
          </p>
          <Link
            href={`/${lang}/inventory`}
            className="inline-block text-sm text-blue-400 hover:underline"
          >
            Browse all condos &rarr;
          </Link>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {g.heading}{" "}
                <span className="text-zinc-500 font-normal text-sm tabular-nums">
                  ({g.stations.length})
                </span>
              </h2>
              <p className="text-zinc-500 text-xs mt-0.5">{g.blurb}</p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {g.stations.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${lang}/near/${s.slug}`}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 hover:border-zinc-700 hover:bg-zinc-900/60 transition"
                  >
                    <span className="text-zinc-100 text-sm font-medium leading-snug">
                      {s.name}
                    </span>
                    <span className="text-zinc-500 text-xs tabular-nums shrink-0">
                      {s.condoCount} condos
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <nav
        aria-label="Related indexes"
        className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-900 pt-4"
      >
        <span className="text-zinc-600">Browse another way:</span>
        <Link href={`/${lang}/districts`} className="hover:text-zinc-300 hover:underline">
          By district
        </Link>
        <Link href={`/${lang}/developer`} className="hover:text-zinc-300 hover:underline">
          By developer
        </Link>
        <Link href={`/${lang}/inventory`} className="hover:text-zinc-300 hover:underline">
          All condos
        </Link>
      </nav>
    </main>
  );
}
