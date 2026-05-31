import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryGrid } from "@/components/InventoryGrid";
import { canonicalCitySlug, CITIES, getCity } from "@/lib/cities";
import { isLang } from "@/lib/i18n";
import { fetchAllCondos } from "@/lib/queries/condos";
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
  return {
    title: isBangkok
      ? "Thailand Condo Inventory — every building, mapped | RealData"
      : `${cityName} Condo Inventory — every building, mapped | RealData`,
    description: isBangkok
      ? "Every hipflat-tracked condo across Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin, Chonburi. Filter by city + district, browse cards, click for the full report."
      : `Every hipflat-tracked condo in ${cityName}. Filter by district, bubble index, price, see the full report for each building.`,
    alternates: {
      canonical: isBangkok
        ? `${SEO_SITE_URL}/${lang}/inventory`
        : `${SEO_SITE_URL}/${lang}/inventory?city=${city.slug}`,
      languages: langAlternates(
        isBangkok ? "/inventory" : `/inventory?city=${city.slug}`
      ),
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

  const allCondos = await fetchAllCondos();
  const city = resolveCity(cityParam);

  // City scoping: filter the published condo set down to the active city.
  // DB `province` has both compact ("chiangmai") and kebab ("chiang-mai")
  // forms — canonicalCitySlug() normalises every row back to the UI slug so
  // filters/chips work regardless of which scraper wrote the row.
  const condos = allCondos.filter(
    (c) => canonicalCitySlug(c.province) === city.slug
  );

  // Per-city counts for the chip row at the top — drawn from the in-memory
  // dataset so we don't need extra Supabase round-trips.
  const counts = new Map<string, number>();
  for (const c of allCondos) {
    const key = canonicalCitySlug(c.province);
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

  // Distinct districts within the active city (collapse case/whitespace variants).
  const labelByNorm = new Map<string, string>();
  for (const c of condos) {
    const r = c.region;
    if (!r) continue;
    const norm = r.toLowerCase().replace(/[\s\-_]+/g, "");
    const existing = labelByNorm.get(norm);
    if (!existing || (/[A-Z]/.test(r) && !/[A-Z]/.test(existing))) {
      labelByNorm.set(norm, r);
    }
  }
  const districts = [...labelByNorm.values()].sort();

  const cityName = city.name[lang];

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
          {condos.length.toLocaleString()} hipflat-tracked condo buildings
          {city.slug !== "bangkok" ? ` in ${cityName}` : " across Thailand's capital"}
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
        condos={condos}
        hrefPrefix={`/${lang}/condo/`}
        districts={districts}
        cityLabel={cityName}
      />
    </main>
  );
}
