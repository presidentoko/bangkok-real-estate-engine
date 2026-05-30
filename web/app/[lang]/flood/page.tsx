import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FloodLegend } from "@/components/FloodLegend";
import { FloodMapSvg, type FloodPoint } from "@/components/FloodMapSvg";
import { FloodStats } from "@/components/FloodStats";
import { CITIES, cityProvinceSlugs, getCity } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

const BANGKOK_NAME: Record<string, string> = {
  en: "Bangkok",
  ko: "방콕",
  th: "กรุงเทพ",
};

const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];

function resolveCity(slug: string | undefined) {
  if (!slug || slug === "bangkok") {
    return {
      slug: "bangkok" as const,
      name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
      center: BANGKOK_CENTER,
    };
  }
  const city = getCity(slug);
  if (city) return { slug: city.slug, name: city.name, center: city.center };
  return {
    slug: "bangkok" as const,
    name: { en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
    center: BANGKOK_CENTER,
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
  if (!isLang(lang)) return { title: "Flood map — RealData" };
  const t = getDictionary(lang);
  const city = resolveCity(cityParam);
  const isBangkok = city.slug === "bangkok";
  const cityName = city.name[lang];
  const titleBase = `${t.flood.title}${isBangkok ? "" : ` — ${cityName}`}`;
  return {
    title: `${titleBase} — RealData`,
    description: t.flood.lead,
    alternates: {
      canonical: isBangkok
        ? `${SEO_SITE_URL}/${lang}/flood`
        : `${SEO_SITE_URL}/${lang}/flood?city=${city.slug}`,
      languages: langAlternates(isBangkok ? "/flood" : `/flood?city=${city.slug}`),
    },
  };
}

// Data refreshes weekly when scrapers run; 1h cache keeps Supabase egress
// well under the free tier even under steady traffic.
export const revalidate = 3600;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]+/g, "");
}

type CondoRow = {
  id: string;
  name: string;
  url: string | null;
  latitude: number | null;
  longitude: number | null;
  region_id: string | null;
  regions: { name: string } | { name: string }[] | null;
  risk_factors?:
    | { flood_risk_level: number | null }
    | { flood_risk_level: number | null }[]
    | null;
};

type GeoFeature = {
  properties: { name?: string; flood_risk_level?: number | null };
};

function regionName(r: CondoRow): string | null {
  const rg = r.regions;
  if (!rg) return null;
  if (Array.isArray(rg)) return rg[0]?.name ?? null;
  return rg.name ?? null;
}

function riskLevel(r: CondoRow): number | null {
  const rf = r.risk_factors;
  if (!rf) return null;
  const obj = Array.isArray(rf) ? rf[0] : rf;
  return obj?.flood_risk_level ?? null;
}

export default async function FloodPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ city?: string }>;
}) {
  const { lang } = await params;
  const { city: cityParam } = await searchParams;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);
  const city = resolveCity(cityParam);
  const isBangkok = city.slug === "bangkok";

  const supabase = getServerSupabase();
  // Bangkok uses district choropleth (legacy behavior). Other cities don't have
  // a district geojson yet — we still fetch points and color them by the
  // per-condo risk_factors.flood_risk_level where present, falling back to
  // unknown otherwise.
  const condoSelect = isBangkok
    ? "id, name, url, latitude, longitude, region_id, regions(name)"
    : "id, name, url, latitude, longitude, region_id, regions(name), risk_factors(flood_risk_level)";

  const [condosRes, geoRes] = await Promise.all([
    isBangkok
      ? supabase
          .from("condos_published")
          .select(condoSelect)
          .eq("source", "hipflat")
          .eq("province", "bangkok")
          .range(0, 9999)
      : supabase
          .from("condos_published")
          .select(condoSelect)
          .eq("source", "hipflat")
          .in("province", cityProvinceSlugs(city.slug))
          .range(0, 9999),
    isBangkok
      ? fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/bangkok-districts.geojson`,
          { next: { revalidate: 3600 } }
        )
          .then((r) => (r.ok ? r.json() : { features: [] }))
          .catch(() => ({ features: [] }))
      : Promise.resolve({ features: [] }),
  ]);

  const condos = (condosRes.data ?? []) as CondoRow[];
  const features = (geoRes.features ?? []) as GeoFeature[];
  const levelByKhet = new Map<string, number>();
  for (const f of features) {
    const name = f.properties?.name ?? "";
    const lvl = f.properties?.flood_risk_level;
    if (typeof lvl === "number") {
      levelByKhet.set(normalize(name), lvl);
    }
  }

  const points: FloodPoint[] = [];
  const byLevel: Record<number, number> = {};
  let unmatched = 0;
  for (const c of condos) {
    if (c.latitude == null || c.longitude == null) continue;
    let level: number | null = null;
    if (isBangkok) {
      const region = regionName(c);
      level = region != null ? levelByKhet.get(normalize(region)) ?? null : null;
    } else {
      level = riskLevel(c);
    }
    if (level == null) unmatched++;
    else byLevel[level] = (byLevel[level] ?? 0) + 1;
    points.push({
      id: c.id,
      name: c.name,
      lat: c.latitude,
      lng: c.longitude,
      level,
      url: c.url,
    });
  }

  const cityName = city.name[lang];
  const ariaLabel = `${cityName} flood risk map`;

  const cityChips: Array<{ slug: string; name: string; href: string }> = [
    { slug: "bangkok", name: BANGKOK_NAME[lang], href: `/${lang}/flood` },
    ...CITIES.map((c) => ({
      slug: c.slug,
      name: c.name[lang],
      href: `/${lang}/flood?city=${c.slug}`,
    })),
  ];

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          🌊 {cityName}{" "}
          <span className="text-zinc-500 font-semibold">
            {t.flood.title.replace(/^🌊\s*/, "")}
          </span>
        </h1>
        <p className="text-zinc-400 text-sm max-w-2xl">{t.flood.lead}</p>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {cityChips.map((c) => {
            const active = c.slug === city.slug;
            return (
              <Link
                key={c.slug}
                href={c.href}
                className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${
                  active
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      </header>

      {!isBangkok && points.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm rounded-2xl p-4 mb-4">
          No geo-located condos yet for {cityName}. The scrapers populate
          lat/lng over time — check back after the next sweep.
        </div>
      )}

      {!isBangkok && (
        <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs rounded-2xl p-3 mb-4">
          District-level flood polygons currently only exist for Bangkok.
          For {cityName}, condo dots are colored by their per-building flood-risk score
          (where available) — district choropleth coming soon.
        </div>
      )}

      <div className="mb-4">
        <FloodStats
          lang={lang}
          totalGeolocated={points.length}
          totalBuildings={condos.length}
          byLevel={byLevel}
          unmatched={unmatched}
        />
      </div>

      <FloodMapSvg
        points={points}
        condoLinkPrefix={`/${lang}/condo/`}
        districts={{ type: "FeatureCollection", features: features as unknown as Array<Record<string, unknown>> }}
        fallbackCenter={city.center}
        ariaLabel={ariaLabel}
      />

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        <FloodLegend lang={lang} />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm space-y-2">
          <div className="font-semibold text-zinc-200">{t.flood.whyDistrict}</div>
          <p className="text-zinc-400 leading-relaxed">{t.flood.whyDistrictBody}</p>
          <div className="pt-2 border-t border-zinc-800">
            <div className="font-semibold text-zinc-200 mb-1">{t.flood.refreshTitle}</div>
            <p className="text-zinc-400 leading-relaxed">{t.flood.refreshBody}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
