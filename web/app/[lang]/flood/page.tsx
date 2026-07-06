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
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
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

  const title = isBangkok && lang === "en"
    ? "Bangkok Flood Risk Map — All 50 Districts Scored | RealData"
    : `${cityName} Flood Risk Map | RealData`;
  const description = isBangkok && lang === "en"
    ? "Which Bangkok districts flood every monsoon season — and which stay dry. All 50 khet scored 0–5 using BMA Drainage Dept, JICA, and 2011 great flood records. Every condo plotted on the risk map."
    : t.flood.lead;

  return {
    title,
    description,
    alternates: {
      canonical: isBangkok
        ? `${SEO_SITE_URL}/${lang}/flood`
        : `${SEO_SITE_URL}/${lang}/flood?city=${city.slug}`,
      languages: langAlternates(isBangkok ? "/flood" : `/flood?city=${city.slug}`),
    },
    openGraph: {
      title,
      description,
      url: isBangkok ? `${SEO_SITE_URL}/${lang}/flood` : `${SEO_SITE_URL}/${lang}/flood?city=${city.slug}`,
      type: "website",
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
  const condoSelect: string = isBangkok
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
          `${SEO_SITE_URL}/bangkok-districts.geojson`,
          { next: { revalidate: 3600 } }
        )
          .then((r) => (r.ok ? r.json() : { features: [] }))
          .catch(() => ({ features: [] }))
      : Promise.resolve({ features: [] }),
  ]);

  const condos = (condosRes.data ?? []) as unknown as CondoRow[];
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

  // Flood-risk ranking by district (Bangkok only) — pillar table for SEO/AEO.
  const districtRanking: Array<{ district: string; level: number; condos: number }> = [];
  if (isBangkok) {
    const condosByKhet = new Map<string, number>();
    for (const c of condos) {
      const region = regionName(c);
      if (!region) continue;
      condosByKhet.set(normalize(region), (condosByKhet.get(normalize(region)) ?? 0) + 1);
    }
    for (const f of features) {
      const name = f.properties?.name ?? "";
      const lvl = f.properties?.flood_risk_level;
      if (!name || typeof lvl !== "number") continue;
      districtRanking.push({ district: name, level: lvl, condos: condosByKhet.get(normalize(name)) ?? 0 });
    }
    districtRanking.sort((a, b) => b.level - a.level || b.condos - a.condos);
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

  const webPageJsonLd = isBangkok ? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Bangkok Flood Risk Map — All 50 Districts",
    description: "Interactive flood risk map for all 50 Bangkok khet, scored 0–5 using BMA Drainage Dept, JICA, and 2011 great flood records. Every tracked condo plotted by flood level.",
    url: `${SEO_SITE_URL}/${lang}/flood`,
    inLanguage: lang,
    about: {
      "@type": "Dataset",
      name: "Bangkok District Monsoon Flood Risk Dataset",
      description: "Flood risk scores (0–5) for all 50 Bangkok khet (districts), calibrated against BMA Drainage Department records, JICA hydrological reports, and 2011 great flood inundation mapping. Reviewed annually.",
      creator: { "@type": "Organization", name: "RealData", url: SEO_SITE_URL },
      keywords: ["Bangkok flood risk", "Bangkok khet flood", "BMA flood data", "2011 Bangkok flood", "monsoon flooding Bangkok", "Bangkok district flood map"],
      spatialCoverage: { "@type": "Place", name: "Bangkok Metropolitan Region", addressCountry: "TH" },
      temporalCoverage: "2011/",
      isAccessibleForFree: true,
    },
  } : null;

  return (
    <main className="max-w-5xl mx-auto p-6">
      {webPageJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
        />
      )}
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          🌊 {cityName}{" "}
          <span className="text-zinc-500 font-semibold">
            {isBangkok ? t.flood.title.replace(/^🌊\s*/, "") : "flood risk"}
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

      {!isBangkok && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 max-w-2xl">
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">
            Flood risk for {cityName} is coming soon
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We currently map district-level monsoon flood risk for <strong>Bangkok only</strong>.
            BMA (Bangkok Metropolitan Administration) is the only authority publishing
            per-district flood records granular enough to score individual buildings — we’re
            researching equivalent sources for {cityName}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href={`/${lang}/flood`}
              className="px-3 py-1.5 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-400 transition"
            >
              View Bangkok flood map
            </Link>
            <Link
              href={`/${lang}/inventory?city=${city.slug}`}
              className="px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition"
            >
              Browse {cityName} inventory
            </Link>
          </div>
        </section>
      )}

      {isBangkok && districtRanking.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Bangkok districts by flood risk</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-zinc-400 border-b border-zinc-800">
                  <th className="py-2 pr-4">District</th>
                  <th className="py-2 pr-4">Flood risk</th>
                  <th className="py-2 pr-4">Tracked condos</th>
                </tr>
              </thead>
              <tbody>
                {districtRanking.slice(0, 20).map((d) => (
                  <tr key={d.district} className="border-b border-zinc-900">
                    <td className="py-2 pr-4 text-zinc-200">{d.district}</td>
                    <td className="py-2 pr-4 text-zinc-300">L{d.level}</td>
                    <td className="py-2 pr-4 text-zinc-400">{d.condos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Flood risk is rated L1 (lowest) to L5 (highest) from Bangkok’s district flood model. See{" "}
            <Link className="text-blue-400" href={`/${lang}/glossary/flood-risk-level`}>how we score flood risk</Link>.
          </p>
        </section>
      )}

      {isBangkok && (
        <>
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

          {/* FAQ — AEO + SEO surface for common Bangkok flood questions */}
          {(() => {
            const highRisk = districtRanking.filter((d) => d.level >= 4).map((d) => d.district).slice(0, 6);
            const lowRisk = districtRanking.filter((d) => d.level <= 1).map((d) => d.district).slice(0, 6);
            const faqItems = [
              {
                q: "Which Bangkok districts have the highest flood risk?",
                a: highRisk.length > 0
                  ? `Districts rated Level 4–5 (highest risk) include ${highRisk.join(", ")}. These areas experienced sustained inundation during the 2011 great flood and face recurring monsoon flooding. Each condo page shows its district's exact flood level.`
                  : "Districts in outer Bangkok — particularly north and east — typically carry the highest flood risk (Level 4–5). Central elevated areas like Pathum Wan and Watthana are generally Level 1–2.",
              },
              {
                q: "Which areas of Bangkok are safe from flooding?",
                a: lowRisk.length > 0
                  ? `Districts rated Level 0–1 (lowest risk) include ${lowRisk.join(", ")}. These areas have elevated terrain and robust BMA drainage infrastructure. Pathum Wan (Siam/Phloen Chit), Watthana (Asok/Phrom Phong), and Bang Rak (Silom) are typically the driest zones.`
                  : "Central Bangkok districts — Pathum Wan, Bang Rak, and Watthana — are rated Level 1 (very low risk) due to elevated terrain and robust BMA drainage. They stayed largely dry during the 2011 great flood.",
              },
              {
                q: "How is Bangkok flood risk measured?",
                a: "RealData assigns each of Bangkok's 50 khet (districts) a flood risk level from 0 to 5 using three primary sources: BMA (Bangkok Metropolitan Administration) Drainage Department records, JICA flood frequency reports, and 2011 great flood inundation maps. Level 0 = no observed flooding; Level 5 = repeat full-area inundation during monsoon season. The layer is reviewed annually after each BMA monsoon report.",
              },
              {
                q: "Did the 2011 Bangkok flood affect all areas of the city?",
                a: "No. The 2011 great flood primarily affected outer districts north and east of Bangkok — including Lak Si, Don Mueang, Lat Phrao, Nong Chok, and Khlong Sam Wa — which saw waist-deep flooding lasting weeks. The central business districts (Silom, Sukhumvit, Siam) were largely protected by elevated terrain and the King's Dyke flood barriers. RealData's flood risk model is calibrated against these 2011 records.",
              },
              {
                q: "Is Sukhumvit safe from flooding in Bangkok?",
                a: "Sukhumvit spans multiple districts with varying flood risk. Lower Sukhumvit (Khlong Toei, Watthana — BTS Asok to Phrom Phong area) carries Level 1–2 risk and stayed dry in 2011. Upper Sukhumvit extending toward On Nut, Phra Khanong, and Bang Na has Level 2–3 risk with occasional street flooding during heavy monsoon rains. Check the individual building page for its exact district flood level.",
              },
            ];
            const faqJsonLd = buildFaqJsonLd(faqItems);
            return (
              <>
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
                />
                <section className="mt-10">
                  <h2 className="text-xl font-semibold mb-4">Bangkok flood risk — frequently asked questions</h2>
                  <dl className="space-y-3">
                    {faqItems.map((f) => (
                      <div key={f.q} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                        <dt className="font-semibold text-zinc-100 mb-2">{f.q}</dt>
                        <dd className="text-zinc-400 text-sm leading-relaxed">{f.a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </>
            );
          })()}
        </>
      )}
    </main>
  );
}
