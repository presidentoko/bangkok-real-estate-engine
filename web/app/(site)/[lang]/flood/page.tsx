import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FloodCityGate } from "@/components/FloodCityGate";
import { FloodLegend } from "@/components/FloodLegend";
import { FloodMapSvg, type FloodPoint } from "@/components/FloodMapSvg";
import { FloodStats } from "@/components/FloodStats";
import { FLOOD_DISTRICTS, findFloodDistrict, type FloodDistrict } from "@/lib/floodDistricts";
import { FLOOD_LAYER_REVISED, loadFloodLayer } from "@/lib/floodLayer.server";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { getFloodCatalogue } from "@/lib/queries/floodCatalogue";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

const BANGKOK_CENTER: [number, number] = [100.5018, 13.7563];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Flood map — RealData" };
  const t = getDictionary(lang);

  const title = t.seo.floodTitle;
  const description = t.seo.floodDesc;

  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/flood`,
      languages: langAlternates("/flood"),
    },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}/flood` }),
  };
}

// Data refreshes weekly when scrapers run; 1h cache keeps Supabase egress
// well under the free tier even under steady traffic.
//
// Static shell — no searchParams read here. Reading ?city server-side
// silently opted the whole route out of ISR, which was true for this page
// and 3 others before 2026-07-11. Bangkok is the only city with a
// district-level flood model — every other ?city= value only ever rendered a
// static "coming soon" message with no data, so FloodCityGate (client) can
// toggle that in purely client-side after reading ?city on mount; no new API
// route is needed.
// 3600 (hourly) regenerated this page ~24x more often than the flood
// dataset (a static geojson, revalidate 3600 on its own fetch) or the
// underlying condo data (weekly) actually change — pure wasted ISR writes.
// Bumped 86400->604800 for the same reason (2026-07-25): condo data only
// moves on the weekly refresh.
export const revalidate = 604800;

export default async function FloodPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  const layer = loadFloodLayer();
  const { condos, latestSeen } = await getFloodCatalogue();

  // One district per building (getFloodCatalogue -> layer.assign), used for
  // every number on this page -- the map dot's colour, the level bars and
  // the "Tracked condos" column -- and by every /flood/[district] page, so
  // they all add up to the same total. Before 2026-11-10 the table joined
  // regions.name against the display name, which missed every "vadhana" and
  // "sathon" building, and the level bars joined against a geojson fetch
  // that came back empty.
  const points: FloodPoint[] = [];
  const byLevel: Record<number, number> = {};
  const condosByKhet = new Map<string, number>();
  let unmatched = 0;
  for (const c of condos) {
    const district: FloodDistrict | null = c.district ? findFloodDistrict(c.district) : null;
    if (district == null) unmatched++;
    else {
      byLevel[district.level] = (byLevel[district.level] ?? 0) + 1;
      condosByKhet.set(district.slug, (condosByKhet.get(district.slug) ?? 0) + 1);
    }
    if (c.lat == null || c.lng == null) continue;
    points.push({
      id: c.id,
      slug: c.slug,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      level: district?.level ?? null,
      url: c.url,
    });
  }

  // Flood-risk ranking by district -- pillar table for SEO/AEO, and since
  // 2026-08-31 the hub that links out to the 50 per-khet answer pages.
  // Levels come from FLOOD_DISTRICTS (the committed projection of the same
  // GeoJSON), so each slug is the one /flood/[district] and /district/[slug]
  // both resolve.
  const districtRanking = FLOOD_DISTRICTS.map((d) => ({
    district: lang === "th" && d.nameTh ? d.nameTh : d.name,
    slug: d.slug,
    level: d.level,
    condos: condosByKhet.get(d.slug) ?? 0,
  }));
  const minLevel = Math.min(...FLOOD_DISTRICTS.map((d) => d.level));
  const maxLevel = Math.max(...FLOOD_DISTRICTS.map((d) => d.level));
  const dataAsOf = latestSeen ? latestSeen.slice(0, 10) : null;

  const cityName = "Bangkok";
  const ariaLabel = `${cityName} flood risk map`;

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Bangkok Flood Risk Map — All 50 Districts",
    description: `Interactive flood risk map for all 50 Bangkok khet, scored ${minLevel}–${maxLevel} using BMA Drainage Dept, JICA, and 2011 great flood records. Every tracked condo plotted by flood level.`,
    url: `${SEO_SITE_URL}/${lang}/flood`,
    inLanguage: lang,
    about: {
      "@type": "Dataset",
      name: "Bangkok District Monsoon Flood Risk Dataset",
      description: `Flood risk scores (${minLevel}–${maxLevel}) for all 50 Bangkok khet (districts), calibrated against BMA Drainage Department records, JICA hydrological reports, and 2011 great flood inundation mapping. Levels last revised ${FLOOD_LAYER_REVISED}.`,
      dateModified: FLOOD_LAYER_REVISED,
      creator: { "@type": "Organization", name: "RealData", url: SEO_SITE_URL },
      license: `${SEO_SITE_URL}/${lang}/about`,
      keywords: ["Bangkok flood risk", "Bangkok khet flood", "BMA flood data", "2011 Bangkok flood", "monsoon flooding Bangkok", "Bangkok district flood map"],
      spatialCoverage: { "@type": "Place", name: "Bangkok Metropolitan Region", addressCountry: "TH" },
      temporalCoverage: "2011/",
      isAccessibleForFree: true,
    },
  };

  // Level of a khet by slug, so the FAQ prose cannot drift from the table.
  const lv = (slug: string) => FLOOD_DISTRICTS.find((d) => d.slug === slug)?.level;
  const highRisk = districtRanking.filter((d) => d.level >= 4).map((d) => d.district).slice(0, 6);
  const lowRisk = districtRanking.filter((d) => d.level === minLevel).map((d) => d.district).slice(0, 6);
  const faqItems = [
    {
      q: "Which Bangkok districts have the highest flood risk?",
      a: highRisk.length > 0
        ? `Districts rated Level 4–5 (highest risk) include ${highRisk.join(", ")}. These areas experienced sustained inundation during the 2011 great flood and face recurring monsoon flooding. Each condo page shows its district's exact flood level.`
        : `Districts in outer Bangkok — particularly north and east — typically carry the highest flood risk (Level 4–5). Central elevated areas like Pathum Wan (Level ${lv("pathum-wan")}) and Watthana (Level ${lv("vadhana")}) are at the low end.`,
    },
    {
      q: "Which areas of Bangkok are safe from flooding?",
      a: lowRisk.length > 0
        ? `Districts rated Level ${minLevel} (lowest risk) are ${lowRisk.join(", ")}. These areas have elevated terrain and robust BMA drainage infrastructure. Watthana (Asok/Phrom Phong) and Khlong Toei are one step up, at Level ${lv("vadhana")}. No district is risk-free: Level ${minLevel} is the lowest score any Bangkok khet receives.`
        : `Central Bangkok districts — Pathum Wan and Bang Rak — are rated Level ${lv("pathum-wan")} (very low risk) due to elevated terrain and robust BMA drainage. They stayed largely dry during the 2011 great flood.`,
    },
    {
      q: "How is Bangkok flood risk measured?",
      a: `RealData assigns each of Bangkok's 50 khet (districts) a flood risk level from ${minLevel} to ${maxLevel} using three primary sources: BMA (Bangkok Metropolitan Administration) Drainage Department records, JICA flood frequency reports, and 2011 great flood inundation maps. Level 1 = very low (central, elevated, well drained); Level 5 = repeat full-area inundation during monsoon season. No Bangkok district is rated 0 (no observed flooding). Each building takes the level of the district polygon its coordinates fall in. Levels were last revised on ${FLOOD_LAYER_REVISED}; the layer is reviewed after each BMA monsoon report.`,
    },
    {
      q: "Did the 2011 Bangkok flood affect all areas of the city?",
      a: "No. The 2011 great flood primarily affected outer districts north and east of Bangkok — including Lak Si, Don Mueang, Lat Phrao, Nong Chok, and Khlong Sam Wa — which saw waist-deep flooding lasting weeks. The central business districts (Silom, Sukhumvit, Siam) were largely protected by elevated terrain and the King's Dyke flood barriers. RealData's flood risk model is calibrated against these 2011 records.",
    },
    {
      q: "Is Sukhumvit safe from flooding in Bangkok?",
      a: `Sukhumvit spans multiple districts with varying flood risk. Lower Sukhumvit (Khlong Toei, Watthana — BTS Asok to Phrom Phong area) is Level ${lv("khlong-toei")} and stayed dry in 2011. Upper Sukhumvit extending toward On Nut, Phra Khanong, and Bang Na is Level ${lv("phra-khanong")}, with occasional street flooding during heavy monsoon rains. Check the individual building page for its exact district flood level.`,
    },
  ];
  const faqJsonLd = buildFaqJsonLd(faqItems);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(webPageJsonLd) }}
      />

      <FloodCityGate
        lang={lang}
        lead={t.flood.lead}
        bangkokTitle={t.flood.title.replace(/^🌊\s*/, "")}
      >
        {districtRanking.length > 0 && (
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
                  {/* All 50, not the top 20. The 30 rows this used to cut
                      were the low-risk khet — Pathum Wan, Bang Rak,
                      Watthana — i.e. exactly the districts a buyer searches
                      to confirm are dry, and the only path to their answer
                      pages. */}
                  {districtRanking.map((d) => (
                    <tr key={d.slug} className="border-b border-zinc-900">
                      <td className="py-2 pr-4">
                        <Link
                          className="text-zinc-200 hover:text-emerald-400 hover:underline"
                          href={`/${lang}/flood/${d.slug}`}
                        >
                          {d.district}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-zinc-300">L{d.level}</td>
                      <td className="py-2 pr-4 text-zinc-400">{d.condos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Flood risk is rated L{minLevel} (lowest) to L{maxLevel} (highest) from Bangkok’s district flood model. No Bangkok district is rated L0. Condos are counted in the district their coordinates fall in. See{" "}
              <Link className="text-blue-400" href={`/${lang}/glossary/flood-risk-level`}>how we score flood risk</Link>.
            </p>
          </section>
        )}

        <div className="mb-4">
          <FloodStats
            lang={lang}
            totalGeolocated={points.length}
            totalBuildings={condos.length}
            byLevel={byLevel}
            unmatched={unmatched}
          />
          <p className="text-xs text-zinc-500 mt-2">{t.flood.asOf(FLOOD_LAYER_REVISED, dataAsOf)}</p>
        </div>

        <FloodMapSvg
          points={points}
          condoLinkPrefix={`/${lang}/condo/`}
          districts={{ type: "FeatureCollection", features: layer.features as unknown as Array<Record<string, unknown>> }}
          fallbackCenter={BANGKOK_CENTER}
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
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
      </FloodCityGate>
    </main>
  );
}
