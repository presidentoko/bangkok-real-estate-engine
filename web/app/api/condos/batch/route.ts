import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { encodeCompact } from "@/lib/condo-compact";
import type { CondoSummary, PropertyType } from "@/lib/queries/condos";

// GET /api/condos/batch?ids=id1,id2,id3
// Returns compact condo summaries for explicit IDs (max 50).
// Used by the saved-condos page to hydrate localStorage IDs server-side.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json(
      {
        v: 1,
        count: 0,
        id: [],
        name: [],
        region: [],
        hero: [],
        bubble: [],
        superValue: [],
        flood: [],
        units: [],
        sale: [],
        rent: [],
        currency: [],
        type: [],
        source: [],
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const supabase = getServerSupabase();

  // Use the same embedded-join SELECT pattern as the rest of the query layer so
  // Supabase returns value_scores + risk_factors as nested objects in one
  // round-trip instead of three.
  const SELECT =
    "id, name, url, latitude, longitude, hero_image_url, total_units, " +
    "available_units_count, market_sale_median, market_rent_median, " +
    "market_summary_currency, property_type, province, source, regions(name), " +
    "value_scores(bubble_index,is_super_value), risk_factors(flood_risk_level)";

  type Joined = {
    id: string;
    name: string;
    url: string | null;
    latitude: number | null;
    longitude: number | null;
    hero_image_url: string | null;
    total_units: number | null;
    available_units_count: number | null;
    market_sale_median: number | null;
    market_rent_median: number | null;
    market_summary_currency: string | null;
    property_type?: string | null;
    province?: string | null;
    source?: string | null;
    regions: { name: string } | { name: string }[] | null;
    value_scores:
      | { bubble_index: number | null; is_super_value: boolean | null }
      | { bubble_index: number | null; is_super_value: boolean | null }[]
      | null;
    risk_factors:
      | { flood_risk_level: number | null }
      | { flood_risk_level: number | null }[]
      | null;
  };

  const { data, error } = await supabase
    .from("condos_published")
    .select(SELECT)
    .in("id", ids);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const rowMap = new Map<string, Joined>();
  for (const r of (data ?? []) as unknown as Joined[]) {
    rowMap.set(r.id, r);
  }

  // Preserve the saved order (ids array order).
  const rows: CondoSummary[] = ids
    .map((id) => {
      const r = rowMap.get(id);
      if (!r) return null;
      const region =
        (Array.isArray(r.regions) ? r.regions[0] : r.regions)?.name ?? null;
      const vs = Array.isArray(r.value_scores)
        ? r.value_scores[0]
        : r.value_scores;
      const rf = Array.isArray(r.risk_factors)
        ? r.risk_factors[0]
        : r.risk_factors;
      return {
        id: r.id,
        name: r.name,
        url: r.url,
        latitude: r.latitude,
        longitude: r.longitude,
        region,
        province: r.province ?? "bangkok",
        hero_image_url: r.hero_image_url,
        bubble_index: vs?.bubble_index ?? null,
        is_super_value: vs?.is_super_value ?? null,
        flood_risk_level: rf?.flood_risk_level ?? null,
        total_units: r.total_units,
        available_units_count: r.available_units_count,
        market_sale_median: r.market_sale_median,
        market_rent_median: r.market_rent_median,
        market_summary_currency: r.market_summary_currency,
        property_type: ((r.property_type ?? "condo") as PropertyType),
        source: r.source ?? "hipflat",
      } satisfies CondoSummary;
    })
    .filter((r): r is CondoSummary => r !== null);

  const compact = encodeCompact(rows);
  // Strip lat/lng (not needed in saved list, saves bandwidth).
  const { lat: _lat, lng: _lng, ...slim } = compact;
  return NextResponse.json(slim, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
