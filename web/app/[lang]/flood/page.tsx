import { notFound } from "next/navigation";
import { FloodLegend } from "@/components/FloodLegend";
import { FloodMap, type FloodPoint } from "@/components/FloodMap";
import { FloodStats } from "@/components/FloodStats";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { getServerSupabase } from "@/lib/supabase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Flood map — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.flood.title} — RealData`,
    description: t.flood.lead,
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

export default async function FloodPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  const supabase = getServerSupabase();
  const [condosRes, geoRes] = await Promise.all([
    supabase
      .from("condos_published")
      .select("id, name, url, latitude, longitude, region_id, regions(name)")
      .eq("source", "hipflat")
      .range(0, 9999),
    fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/bangkok-districts.geojson`,
      { next: { revalidate: 3600 } }
    )
      .then((r) => (r.ok ? r.json() : { features: [] }))
      .catch(() => ({ features: [] })),
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
    const region = regionName(c);
    const level = region != null ? levelByKhet.get(normalize(region)) ?? null : null;
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

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t.flood.title}</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">{t.flood.lead}</p>
      </header>

      <div className="mb-4">
        <FloodStats
          lang={lang}
          totalGeolocated={points.length}
          totalBuildings={condos.length}
          byLevel={byLevel}
          unmatched={unmatched}
        />
      </div>

      <FloodMap
        points={points}
        condoLinkPrefix={`/${lang}/condo/`}
        districts={{ type: "FeatureCollection", features: features as unknown as Array<Record<string, unknown>> }}
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
