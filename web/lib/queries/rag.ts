/**
 * Retrieval-augmented-generation helpers — pulls a slice of the DB that's
 * broadly relevant to any property question, plus name-matched condos for
 * the specific query. Cheap (no embeddings), good enough for v1.
 *
 * Returns a compact JSON-ish context block we feed to Claude as part of the
 * system prompt. The LLM filters/quotes what matters for the user's question.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Condo = {
  id: string;
  name: string;
  province: string | null;
  region_name: string | null;
  url: string | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  bubble_index: number | null;
  flood_risk_level: number | null;
  completion_year: number | null;
  total_units: number | null;
  market_sale_per_sqm: number | null;
  market_rent_per_sqm: number | null;
};

type ConsoleRow = {
  id: string;
  name: string;
  province: string | null;
  url: string | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  completion_year: number | null;
  total_units: number | null;
  regions: { name: string } | { name: string }[] | null;
};

function regionOf(r: ConsoleRow): string | null {
  const rg = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  return rg?.name ?? null;
}

function asCondo(r: ConsoleRow, vs?: Map<string, number>, rf?: Map<string, number>): Condo {
  return {
    id: r.id,
    name: r.name,
    province: r.province,
    region_name: regionOf(r),
    url: r.url,
    gross_yield_pct: r.gross_yield_pct,
    avg_sale_price: r.avg_sale_price,
    avg_monthly_rent: r.avg_monthly_rent,
    bubble_index: vs?.get(r.id) ?? null,
    flood_risk_level: rf?.get(r.id) ?? null,
    completion_year: r.completion_year,
    total_units: r.total_units,
    market_sale_per_sqm: null,
    market_rent_per_sqm: null,
  };
}

async function hydrate(
  supabase: SupabaseClient,
  rows: ConsoleRow[],
): Promise<Condo[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [{ data: vsData }, { data: rfData }] = await Promise.all([
    supabase.from("value_scores").select("condo_id, bubble_index").in("condo_id", ids),
    supabase.from("risk_factors").select("condo_id, flood_risk_level").in("condo_id", ids),
  ]);
  const vsMap = new Map<string, number>();
  for (const v of (vsData ?? []) as Array<{ condo_id: string; bubble_index: number | null }>) {
    if (v.bubble_index != null) vsMap.set(v.condo_id, v.bubble_index);
  }
  const rfMap = new Map<string, number>();
  for (const r of (rfData ?? []) as Array<{ condo_id: string; flood_risk_level: number | null }>) {
    if (r.flood_risk_level != null) rfMap.set(r.condo_id, r.flood_risk_level);
  }
  return rows.map((r) => asCondo(r, vsMap, rfMap));
}

const SELECT = (
  "id, name, province, url, " +
  "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
  "completion_year, total_units, regions(name)"
);

export type RetrievalContext = {
  mortgageRate: { rate: number; period: string } | null;
  topYields: Condo[];                  // highest yield (filtered for outliers)
  underpriced: Condo[];                // lowest bubble_index
  recentMovers: Condo[];               // biggest price deltas
  nameMatches: Condo[];                // explicit name match if user mentioned one
  cityCounts: Array<{ province: string; n: number }>;
  totalCondos: number;
  totalListings: number;
};

export async function retrieveContext(
  supabase: SupabaseClient,
  question: string,
): Promise<RetrievalContext> {
  // 0) Cheap counts
  const [{ count: totalCondos }, { count: totalListings }] = await Promise.all([
    supabase.from("condos").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  // 1) MRR
  const { data: mrrRows } = await supabase
    .from("macro_indicators")
    .select("indicator_name, value, period")
    .eq("source", "bot")
    .eq("series_code", "FM_RT_001_S2")
    .in("indicator_name", ["MRR (Minimum Retail Rate) Min", "MRR (Minimum Retail Rate) Max"])
    .order("period", { ascending: false })
    .limit(20);
  let mortgageRate: RetrievalContext["mortgageRate"] = null;
  if (mrrRows && mrrRows.length > 0) {
    const latest = (mrrRows[0] as { period: string }).period;
    const same = mrrRows.filter(
      (r) => (r as { period: string }).period === latest,
    ) as Array<{ value: number; period: string }>;
    mortgageRate = {
      rate: same.reduce((a, b) => a + Number(b.value), 0) / same.length,
      period: latest,
    };
  }

  // 2) Top yields (filtered for outliers)
  const { data: yRows } = await supabase
    .from("condos")
    .select(SELECT)
    .gte("gross_yield_pct", 5)
    .lte("gross_yield_pct", 25)
    .gte("avg_sale_price", 500_000)
    .gte("yield_sample_sale", 2)
    .gte("yield_sample_rent", 2)
    .order("gross_yield_pct", { ascending: false })
    .limit(10);
  const topYields = await hydrate(supabase, (yRows ?? []) as unknown as ConsoleRow[]);

  // 3) Underpriced (bubble_index ≤ 90 means priced below district avg)
  const { data: undRows } = await supabase
    .from("value_scores")
    .select("condo_id, bubble_index")
    .lte("bubble_index", 90)
    .order("bubble_index", { ascending: true })
    .limit(20);
  const undIds = ((undRows ?? []) as Array<{ condo_id: string; bubble_index: number }>)
    .map((r) => r.condo_id)
    .slice(0, 10);
  let underpriced: Condo[] = [];
  if (undIds.length > 0) {
    const { data: condoRows } = await supabase
      .from("condos")
      .select(SELECT)
      .in("id", undIds);
    underpriced = await hydrate(supabase, (condoRows ?? []) as unknown as ConsoleRow[]);
  }

  // 4) Recent movers — biggest signed delta in latest snapshots
  const { data: phRows } = await supabase
    .from("price_history")
    .select("condo_id, delta_pct, listing_type")
    .not("delta_pct", "is", null)
    .order("captured_at", { ascending: false })
    .limit(500);
  type PHRow = { condo_id: string; delta_pct: number; listing_type: string };
  const seenPh = new Set<string>();
  const phDistinct: PHRow[] = [];
  for (const r of (phRows ?? []) as PHRow[]) {
    const key = `${r.condo_id}:${r.listing_type}`;
    if (seenPh.has(key)) continue;
    seenPh.add(key);
    phDistinct.push(r);
  }
  const moverIds = phDistinct
    .filter((r) => Math.abs(r.delta_pct) >= 3)
    .slice(0, 30)
    .map((r) => r.condo_id);
  let recentMovers: Condo[] = [];
  if (moverIds.length > 0) {
    const { data: mvRows } = await supabase
      .from("condos")
      .select(SELECT)
      .in("id", moverIds);
    recentMovers = await hydrate(supabase, (mvRows ?? []) as unknown as ConsoleRow[]);
  }

  // 5) Name matches in the question (tokens ≥ 3 chars, ILIKE)
  const tokens = question
    .toLowerCase()
    .split(/[^a-zA-Z0-9ก-๙]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  let nameMatches: Condo[] = [];
  if (tokens.length > 0) {
    const ors = tokens.map((t) => `name.ilike.%${t}%`).join(",");
    const { data: nmRows } = await supabase
      .from("condos")
      .select(SELECT)
      .or(ors)
      .limit(10);
    nameMatches = await hydrate(supabase, (nmRows ?? []) as unknown as ConsoleRow[]);
  }

  // 6) City counts — use head-only count queries (zero row egress) instead of
  // fetching 10k province strings and counting in JS.
  const PROVINCE_GROUPS: Array<{ key: string; aliases: string[] }> = [
    { key: "bangkok",   aliases: ["bangkok"] },
    { key: "pattaya",   aliases: ["pattaya"] },
    { key: "phuket",    aliases: ["phuket"] },
    { key: "chiangmai", aliases: ["chiangmai", "chiang-mai"] },
    { key: "huahin",    aliases: ["huahin", "hua-hin"] },
    { key: "chonburi",  aliases: ["chonburi", "chon-buri"] },
    { key: "samui",     aliases: ["samui", "ko-samui", "surat-thani"] },
    { key: "chiangrai", aliases: ["chiangrai", "chiang-rai"] },
    { key: "krabi",     aliases: ["krabi"] },
  ];
  const countResults = await Promise.all(
    PROVINCE_GROUPS.map(async ({ key, aliases }) => {
      const { count } = await supabase
        .from("condos")
        .select("id", { count: "exact", head: true })
        .in("province", aliases);
      return { province: key, n: count ?? 0 };
    })
  );
  const cityCounts = countResults
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  return {
    mortgageRate,
    topYields,
    underpriced,
    recentMovers,
    nameMatches,
    cityCounts,
    totalCondos: totalCondos ?? 0,
    totalListings: totalListings ?? 0,
  };
}

export function formatContext(ctx: RetrievalContext): string {
  const lines: string[] = [];
  lines.push(
    `DATABASE OVERVIEW: ${ctx.totalCondos.toLocaleString()} condos, ` +
    `${ctx.totalListings.toLocaleString()} active listings across 4 portals ` +
    `(hipflat, dotproperty, ddproperty, fazwaz).`,
  );
  lines.push(`Coverage by province (top): ${ctx.cityCounts
    .slice(0, 8)
    .map((c) => `${c.province}=${c.n}`)
    .join(", ")}`);

  if (ctx.mortgageRate) {
    lines.push(
      `BENCHMARK MORTGAGE RATE: Thai MRR ${ctx.mortgageRate.rate.toFixed(2)}% ` +
      `(BOT, ${ctx.mortgageRate.period.slice(0, 7)}).`,
    );
  }

  const condoLine = (c: Condo): string => {
    const parts = [
      `[${c.name}]`,
      c.region_name ? `${c.region_name}` : c.province ?? "",
      c.gross_yield_pct != null ? `yield=${c.gross_yield_pct.toFixed(2)}%` : "",
      c.bubble_index != null ? `bubble=${c.bubble_index.toFixed(0)}` : "",
      c.avg_sale_price != null ? `sale=฿${(c.avg_sale_price / 1_000_000).toFixed(2)}M` : "",
      c.avg_monthly_rent != null ? `rent=฿${Math.round(c.avg_monthly_rent).toLocaleString()}/mo` : "",
      c.flood_risk_level != null ? `flood=L${c.flood_risk_level}` : "",
      c.completion_year != null ? `built=${c.completion_year}` : "",
      `url=/condo/${c.id}`,
    ].filter(Boolean);
    return parts.join(" ");
  };

  if (ctx.nameMatches.length > 0) {
    lines.push(`\nNAME-MATCHED CONDOS (mentioned or similar to question):`);
    ctx.nameMatches.slice(0, 8).forEach((c) => lines.push(`  · ${condoLine(c)}`));
  }
  if (ctx.topYields.length > 0) {
    lines.push(`\nTOP YIELDS (filtered for outliers):`);
    ctx.topYields.slice(0, 5).forEach((c) => lines.push(`  · ${condoLine(c)}`));
  }
  if (ctx.underpriced.length > 0) {
    lines.push(`\nUNDERPRICED (bubble_index ≤ 90 = below district avg):`);
    ctx.underpriced.slice(0, 5).forEach((c) => lines.push(`  · ${condoLine(c)}`));
  }
  if (ctx.recentMovers.length > 0) {
    lines.push(`\nRECENT PRICE MOVERS (|Δ| ≥ 3% in latest snapshot):`);
    ctx.recentMovers.slice(0, 5).forEach((c) => lines.push(`  · ${condoLine(c)}`));
  }

  return lines.join("\n");
}
