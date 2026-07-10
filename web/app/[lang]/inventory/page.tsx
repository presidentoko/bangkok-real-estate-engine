import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryGrid } from "@/components/InventoryGrid";
import { canonicalCitySlug, CITIES, getCity } from "@/lib/cities";
import { decodeCompact } from "@/lib/condo-compact";
import { isLang } from "@/lib/i18n";
import {
  availablePropertyTypes,
  computeInventoryStats,
  extractDistricts,
  topPicks,
} from "@/lib/inventory";
import {
  fetchCondoProvinces,
  fetchCondoSummariesCompactByCity,
} from "@/lib/queries/condos";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

const BANGKOK_LABEL: Record<string, string> = {
  en: "Bangkok",
  ko: "방콕",
  th: "กรุงเทพ",
};

function resolveCity(slug: string | undefined): { slug: string; name: { en: string; ko: string; th: string } } {
  if (!slug || slug === "bangkok") {
    return {
      slug: "bangkok",
      name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
    };
  }
  const city = getCity(slug);
  if (city) return { slug: city.slug, name: city.name };
  return {
    slug: "bangkok",
    name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ city?: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { city: cityParam } = await searchParams;
  if (!isLang(lang)) return { title: "Inventory — RealData" };
  const city = resolveCity(cityParam);
  const cityName = city.name[lang];
  const isBangkok = city.slug === "bangkok";
  const title = isBangkok
    ? "Bangkok Condo List — All Buildings with Yield, Price & Flood Risk | RealData"
    : `${cityName} Condo List — All Buildings with Yield, Price & Flood Risk | RealData`;
  const description = isBangkok
    ? "Browse 1,800+ condos across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin and Chonburi. Each card shows rental yield, Bubble Index, flood risk, and foreign quota. Filter by city and district."
    : `Browse every tracked condo in ${cityName}. Filter by district, Bubble Index, and price. Each building shows rental yield, flood risk, and foreign-quota availability.`;
  return {
    title,
    description,
    alternates: {
      canonical: isBangkok
        ? `${SEO_SITE_URL}/${lang}/inventory`
        : `${SEO_SITE_URL}/${lang}/inventory?city=${city.slug}`,
      languages: langAlternates(
        isBangkok ? "/inventory" : `/inventory?city=${city.slug}`
      ),
    },
    openGraph: {
      title,
      description,
      url: isBangkok ? `${SEO_SITE_URL}/${lang}/inventory` : `${SEO_SITE_URL}/${lang}/inventory?city=${city.slug}`,
      type: "website",
    },
  };
}

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ city?: string }>;
}) {
  const { lang } = await params;
  const { city: cityParam } = await searchParams;
  if (!isLang(lang)) notFound();

  const city = resolveCity(cityParam);

  // Fetch only the active city's condos (scoped at the DB level) plus a cheap
  // province-only pull for the chip counts. Previously this loaded every condo
  // from every city (~6.4MB) and filtered in JS, which never cached.
  const [condosCompact, allProvinces] = await Promise.all([
    fetchCondoSummariesCompactByCity(city.slug),
    fetchCondoProvinces(),
  ]);
  const condos = decodeCompact(condosCompact);

  // Per-city counts for the chip row at the top. DB `province` has both compact
  // ("chiangmai") and kebab ("chiang-mai") forms — canonicalCitySlug()
  // normalises every value back to the UI slug so counts line up regardless of
  // which scraper wrote the row.
  const counts = new Map<string, number>();
  for (const p of allProvinces) {
    const key = canonicalCitySlug(p);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const cityChips: Array<{ slug: string; name: string; count: number; href: string }> = [
    {
      slug: "bangkok",
      name: BANGKOK_LABEL[lang],
      count: counts.get("bangkok") ?? 0,
      href: `/${lang}/inventory`,
    },
    ...CITIES.map((c) => ({
      slug: c.slug,
      name: c.name[lang],
      count: counts.get(c.slug) ?? 0,
      href: `/${lang}/inventory?city=${c.slug}`,
    })),
  ];

  const cityName = city.name[lang];

  // Everything the grid needs to render its default state + dashboard is
  // computed here on the server. The full city-scoped array is NOT passed to
  // the client — the grid lazy-fetches it from /api/condos/inventory only when
  // the user opens the grid (filter / search / "Show all"). This keeps the
  // initial RSC payload tiny instead of serialising thousands of condo objects.
  const districts = extractDistricts(condos);
  const stats = computeInventoryStats(condos);
  const picks = topPicks(condos);
  const availableTypes = availablePropertyTypes(condos);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <Link
          href={`/${lang}`}
          className="text-zinc-500 hover:text-zinc-300 text-sm inline-block"
        >
          ← back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
          {cityName} <span className="text-zinc-500">inventory</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {condos.length.toLocaleString()} condo buildings tracked across 4 portals
          {city.slug !== "bangkok" ? ` in ${cityName}` : " in Thailand's capital"}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {cityChips.map((c) => {
            const active = c.slug === city.slug;
            const empty = c.count === 0;
            // A 0-count chip used to render as a normal link that took the
            // user to an empty page. Make it non-clickable so the navigation
            // signals "nothing here yet" instead of dead-ending.
            if (empty && !active) {
              return (
                <span
                  key={c.slug}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border border-zinc-900 bg-zinc-950 text-zinc-600 cursor-not-allowed"
                  title={`No inventory indexed for ${c.name} yet`}
                >
                  <span>{c.name}</span>
                  <span className="tabular-nums">0</span>
                </span>
              );
            }
            return (
              <Link
                key={c.slug}
                href={c.href}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition border ${
                  active
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <span className={active ? "font-semibold" : "text-zinc-200 font-medium"}>
                  {c.name}
                </span>
                <span className={active ? "tabular-nums opacity-80" : "text-zinc-500 tabular-nums"}>
                  {c.count.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      <InventoryGrid
        citySlug={city.slug}
        hrefPrefix={`/${lang}/condo/`}
        districts={districts}
        cityLabel={cityName}
        totalCount={condos.length}
        stats={stats}
        topPicks={picks}
        availableTypes={availableTypes}
      />
    </main>
  );
}
