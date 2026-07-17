import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RealityCard } from "@/components/RealityCard";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 86400;

type PriceHistoryRow = {
  price: number;
  delta_pct: number | null;
  captured_at: string;
};

// `id` is the promotion id (not condo id). Every promotion page inherited the
// root layout's generic title until now — one extra lookup per generation is
// cheap at 24h revalidate.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}): Promise<Metadata> {
  const { id, lang } = await params;
  const supabase = getServerSupabase();

  const { data: promo } = await supabase
    .from("condo_promotions")
    .select("condo_id, promoted_by, claim")
    .eq("id", id)
    .maybeSingle();
  if (!promo) return { title: "Advertised vs measured — RealData" };

  const { data: condo } = await supabase
    .from("condos_published")
    .select("name")
    .eq("id", promo.condo_id)
    .maybeSingle();
  if (!condo) return { title: "Advertised vs measured — RealData" };

  const title = `${condo.name} — advertised vs measured | RealData`;
  const description = promo.claim
    ? `${condo.name} was promoted${promo.promoted_by ? ` by ${promo.promoted_by}` : ""} with the claim: "${promo.claim}". See RealData's independently measured price, flood risk, and livability signals for this building.`
    : `See how ${condo.name}'s promoted listing compares to RealData's independently measured price, flood risk, and livability signals.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/reality/${id}`,
      languages: langAlternates(`/reality/${id}`),
    },
    openGraph: {
      title,
      description,
      url: `${SEO_SITE_URL}/${lang}/reality/${id}`,
      type: "article",
    },
  };
}

export default async function RealityPage({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  // `id` is the promotion id (not condo id) — multiple promotions per condo possible.
  const { id } = await params;
  const supabase = getServerSupabase();

  const { data: promo } = await supabase
    .from("condo_promotions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!promo) notFound();

  const condo_id = promo.condo_id;

  const [condoRes, scoreRes, livRes, riskRes, latestRes, historyRes] =
    await Promise.all([
      supabase
        .from("condos_published")
        .select("id, name, developer, url, region_id, regions(name)")
        .eq("id", condo_id)
        .maybeSingle(),
      supabase
        .from("value_scores")
        .select("bubble_index, is_super_value, livability_score")
        .eq("condo_id", condo_id)
        .maybeSingle(),
      supabase
        .from("livability_metrics")
        .select(
          "nearest_bts_distance_m, nearest_mrt_distance_m, hospitals_within_1km, schools_within_1km, supermarkets_within_1km, livability_score"
        )
        .eq("condo_id", condo_id)
        .maybeSingle(),
      supabase
        .from("risk_factors")
        .select("flood_risk_level")
        .eq("condo_id", condo_id)
        .maybeSingle(),
      supabase
        .from("v_latest_listings")
        .select("price, area_sqm, price_per_sqm")
        .eq("condo_id", condo_id)
        .maybeSingle(),
      // Sale rows only — price_history mixes sale and rent snapshots
      // (listing_type column), and summing both would blend rent deltas
      // (small THB moves, huge % swings) into the "total drop" figure.
      supabase
        .from("price_history")
        .select("price, delta_pct, captured_at")
        .eq("condo_id", condo_id)
        .eq("listing_type", "sale")
        .order("captured_at", { ascending: true }),
    ]);

  if (!condoRes.data) notFound();

  const condo = condoRes.data;
  const liv = livRes.data;
  const risk = riskRes.data;
  const score = scoreRes.data;
  const latest = latestRes.data;

  // Aggregate price-drop history.
  const history: PriceHistoryRow[] = historyRes.data ?? [];
  const drops = history.filter((h) => (h.delta_pct ?? 0) < -1);
  const totalDrop = drops.reduce((acc, h) => acc + (h.delta_pct ?? 0), 0);

  // Region avg pps — fetch the specific region of this condo.
  let regionAvgPps: number | null = null;
  if (condo.region_id) {
    const rRow = await supabase
      .from("regions")
      .select("avg_price_per_sqm")
      .eq("id", condo.region_id)
      .maybeSingle();
    const v = rRow.data?.avg_price_per_sqm;
    regionAvgPps = v != null ? Number(v) : null;
  }

  const closestBts =
    liv?.nearest_bts_distance_m != null && liv?.nearest_mrt_distance_m != null
      ? Math.min(liv.nearest_bts_distance_m, liv.nearest_mrt_distance_m)
      : liv?.nearest_bts_distance_m ?? liv?.nearest_mrt_distance_m ?? null;

  const condoFlat = {
    ...condo,
    regions: Array.isArray(condo.regions)
      ? condo.regions[0] ?? null
      : condo.regions ?? null,
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <RealityCard
        condo={condoFlat}
        promotion={{
          id: promo.id,
          promoted_by: promo.promoted_by,
          promotion_url: promo.promotion_url,
          platform: promo.platform,
          claim: promo.claim,
          promoted_at: promo.promoted_at,
        }}
        signals={{
          bubble_index: score?.bubble_index ?? null,
          is_super_value: score?.is_super_value ?? null,
          livability_score: liv?.livability_score ?? null,
          bts_distance_m: closestBts,
          flood_risk_level: risk?.flood_risk_level ?? null,
          hospitals: liv?.hospitals_within_1km ?? 0,
          schools: liv?.schools_within_1km ?? 0,
          supermarkets: liv?.supermarkets_within_1km ?? 0,
          price_drop_count: drops.length,
          price_drop_total_pct: drops.length > 0 ? totalDrop : null,
          list_price: latest?.price ?? null,
          list_pps: latest?.price_per_sqm ?? null,
          region_avg_pps: regionAvgPps,
        }}
      />

      {promo.promotion_url && (
        <div className="mt-6 text-sm text-zinc-500">
          Source:{" "}
          <a
            href={promo.promotion_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-zinc-300 hover:underline break-all"
          >
            {promo.promotion_url}
          </a>
        </div>
      )}
    </main>
  );
}
