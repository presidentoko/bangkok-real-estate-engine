import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InventoryExplorer, type CityChip } from "@/components/InventoryExplorer";
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

// Static shell — no searchParams read here. Reading searchParams server-side
// silently opts the whole route out of ISR (every request becomes a live
// Function invocation), which was true for this page and 3 others before
// 2026-07-11. The default (Bangkok) view renders statically at build/regen
// time; InventoryExplorer (client) reads ?city after hydration and fetches
// the city's compact condo set from /api/condos/inventory when it differs
// from Bangkok, recomputing the dashboard stats client-side.
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
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Inventory — RealData" };
  const title = "Bangkok Condo List — All Buildings with Yield, Price & Flood Risk | RealData";
  const description =
    "Browse 1,800+ condos across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin and Chonburi. " +
    "Each card shows rental yield, Bubble Index, flood risk, and foreign quota. Filter by city and district.";
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/inventory`,
      languages: langAlternates("/inventory"),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}/inventory`,
      type: "website",
    },
  };
}

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const city = resolveCity(undefined); // static shell always renders the Bangkok default

  // Fetch only Bangkok's condos (scoped at the DB level) plus a cheap
  // province-only pull for the chip counts.
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
  const cityChips: CityChip[] = [
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
      <InventoryExplorer
        lang={lang}
        cityChips={cityChips}
        initial={{
          slug: city.slug,
          name: city.name[lang],
          totalCount: condos.length,
          districts,
          stats,
          picks,
          availableTypes,
        }}
      />
    </main>
  );
}
