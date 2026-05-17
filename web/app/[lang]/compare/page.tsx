import type { Metadata } from "next";
import Link from "next/link";
import { fmtTHB } from "@/lib/fmt";
import { isLang } from "@/lib/i18n";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Compare condos — RealData" };
  return {
    title: "Compare Bangkok condos side-by-side — RealData",
    description:
      "Compare 2-3 Bangkok condos head-to-head: yield, mortgage spread, " +
      "flood risk, transit distance, foreign quota, multi-portal price. " +
      "Independent measurement.",
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/compare`,
      languages: langAlternates("/compare"),
    },
  };
}

type CondoFull = {
  id: string;
  name: string;
  url: string | null;
  province: string | null;
  completion_year: number | null;
  total_units: number | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  avg_monthly_rent: number | null;
  market_sale_median: number | null;
  market_rent_median: number | null;
  cam_fee_per_month: number | null;
  sinking_fund: number | null;
  building_ownership: string | null;
  aqi_score: number | null;
  pm25_value: number | null;
  foreign_quota_inventory_pct: number | null;
  regions: { name: string } | { name: string }[] | null;
};

async function fetchCondos(supabase: ReturnType<typeof getServerSupabase>, ids: string[]) {
  if (ids.length === 0) return { condos: [], scores: new Map<string, number>(), risks: new Map<string, number>(), liv: new Map<string, number | null>() };
  const [{ data: condoData }, { data: scoreData }, { data: riskData }, { data: livData }] = await Promise.all([
    supabase
      .from("condos")
      .select(
        "id, name, url, province, completion_year, total_units, " +
        "gross_yield_pct, avg_sale_price, avg_monthly_rent, " +
        "market_sale_median, market_rent_median, " +
        "cam_fee_per_month, sinking_fund, building_ownership, " +
        "aqi_score, pm25_value, foreign_quota_inventory_pct, " +
        "regions(name)"
      )
      .in("id", ids),
    supabase.from("value_scores").select("condo_id, bubble_index").in("condo_id", ids),
    supabase.from("risk_factors").select("condo_id, flood_risk_level").in("condo_id", ids),
    supabase.from("livability_metrics").select("condo_id, nearest_bts_distance_m").in("condo_id", ids),
  ]);
  const scores = new Map<string, number>();
  for (const s of (scoreData ?? []) as Array<{ condo_id: string; bubble_index: number | null }>) {
    if (s.bubble_index != null) scores.set(s.condo_id, Number(s.bubble_index));
  }
  const risks = new Map<string, number>();
  for (const r of (riskData ?? []) as Array<{ condo_id: string; flood_risk_level: number | null }>) {
    if (r.flood_risk_level != null) risks.set(r.condo_id, r.flood_risk_level);
  }
  const liv = new Map<string, number | null>();
  for (const l of (livData ?? []) as Array<{ condo_id: string; nearest_bts_distance_m: number | null }>) {
    liv.set(l.condo_id, l.nearest_bts_distance_m);
  }
  const condos = (condoData ?? []) as unknown as CondoFull[];
  // Preserve input order
  const ordered = ids
    .map((id) => condos.find((c) => c.id === id))
    .filter((c): c is CondoFull => !!c);
  return { condos: ordered, scores, risks, liv };
}

function regionName(r: CondoFull): string {
  const rg = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  return rg?.name ?? (r.province ?? "—").replace(/-/g, " ");
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ a?: string; b?: string; c?: string }>;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  const ids = [sp.a, sp.b, sp.c].filter((v): v is string => !!v && v.length > 8).slice(0, 3);

  const supabase = getServerSupabase();
  const [{ condos, scores, risks, liv }, mortgage] = await Promise.all([
    fetchCondos(supabase, ids),
    getCurrentMortgageRate(supabase),
  ]);
  const mrr = mortgage?.rate ?? null;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Compare condos</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Head-to-head comparison of up to 3 Bangkok condos. Add condos by
          clicking <strong className="text-zinc-300">&quot;Compare with…&quot;</strong> on any
          condo page, or paste ids into the URL as{" "}
          <code className="text-zinc-300">?a=ID&amp;b=ID&amp;c=ID</code>.
        </p>
      </header>

      {condos.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-400">
          <p className="mb-3">No condos selected yet.</p>
          <p className="text-sm">
            Visit a condo page (e.g. via{" "}
            <Link href={`/${lang}/yields`} className="text-emerald-400 hover:underline">
              /yields
            </Link>
            ) and use the &quot;Add to compare&quot; button.
          </p>
        </div>
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 w-40">Metric</th>
                {condos.map((c) => (
                  <th key={c.id} className="text-left px-4 py-3">
                    <Link
                      href={`/${lang}/condo/${c.id}`}
                      className="text-zinc-100 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {/* Location */}
              <tr><td className="px-4 py-3 text-zinc-500">Location</td>
                {condos.map((c) => <td key={c.id} className="px-4 py-3 text-zinc-300 capitalize">{regionName(c)}</td>)}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500">Year built</td>
                {condos.map((c) => <td key={c.id} className="px-4 py-3 tabular-nums">{c.completion_year ?? "—"}</td>)}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500">Total units</td>
                {condos.map((c) => <td key={c.id} className="px-4 py-3 tabular-nums">{c.total_units?.toLocaleString() ?? "—"}</td>)}
              </tr>

              {/* Price */}
              <tr><td className="px-4 py-3 text-zinc-500 bg-zinc-900/30">Avg sale</td>
                {condos.map((c) => (
                  <td key={c.id} className="px-4 py-3 tabular-nums bg-zinc-900/30 font-semibold">
                    {fmtTHB(c.avg_sale_price ?? c.market_sale_median)}
                  </td>
                ))}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500 bg-zinc-900/30">Avg rent</td>
                {condos.map((c) => (
                  <td key={c.id} className="px-4 py-3 tabular-nums bg-zinc-900/30">
                    {fmtTHB(c.avg_monthly_rent ?? c.market_rent_median)}
                    {(c.avg_monthly_rent ?? c.market_rent_median) != null && <span className="text-zinc-500 font-normal text-xs">/mo</span>}
                  </td>
                ))}
              </tr>

              {/* Yield + spread — winner highlighted */}
              <tr><td className="px-4 py-3 text-zinc-500">Gross yield</td>
                {condos.map((c) => {
                  const best = Math.max(...condos.map((x) => x.gross_yield_pct ?? -Infinity));
                  const isBest = c.gross_yield_pct != null && c.gross_yield_pct === best;
                  return (
                    <td
                      key={c.id}
                      className={`px-4 py-3 tabular-nums font-semibold ${isBest ? "text-emerald-400" : ""}`}
                    >
                      {c.gross_yield_pct != null ? `${c.gross_yield_pct.toFixed(2)}%` : "—"}
                      {isBest && <span className="text-xs font-normal text-emerald-500 ml-1">★</span>}
                    </td>
                  );
                })}
              </tr>
              {mrr != null && (
                <tr><td className="px-4 py-3 text-zinc-500">vs MRR ({mrr.toFixed(2)}%)</td>
                  {condos.map((c) => {
                    const spread = c.gross_yield_pct != null ? c.gross_yield_pct - mrr : null;
                    return (
                      <td
                        key={c.id}
                        className={`px-4 py-3 tabular-nums font-semibold ${
                          spread != null
                            ? spread >= 0 ? "text-emerald-400" : "text-rose-400"
                            : ""
                        }`}
                      >
                        {spread != null ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}pp` : "—"}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* Cost */}
              <tr><td className="px-4 py-3 text-zinc-500">CAM fee/mo</td>
                {condos.map((c) => <td key={c.id} className="px-4 py-3 tabular-nums">{fmtTHB(c.cam_fee_per_month)}</td>)}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500">Sinking fund</td>
                {condos.map((c) => <td key={c.id} className="px-4 py-3 tabular-nums">{fmtTHB(c.sinking_fund)}</td>)}
              </tr>

              {/* Risk signals */}
              <tr><td className="px-4 py-3 text-zinc-500 bg-zinc-900/30">Bubble index</td>
                {condos.map((c) => {
                  const v = scores.get(c.id);
                  return (
                    <td
                      key={c.id}
                      className={`px-4 py-3 tabular-nums bg-zinc-900/30 ${
                        v != null
                          ? v <= 90 ? "text-emerald-400" : v >= 110 ? "text-rose-400" : ""
                          : ""
                      }`}
                    >
                      {v != null ? v.toFixed(0) : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500 bg-zinc-900/30">Flood risk (0–5)</td>
                {condos.map((c) => {
                  const v = risks.get(c.id);
                  return (
                    <td key={c.id} className={`px-4 py-3 tabular-nums bg-zinc-900/30 ${
                      v != null && v >= 3 ? "text-rose-400" : ""
                    }`}>
                      {v != null ? `L${v}` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500 bg-zinc-900/30">Nearest BTS</td>
                {condos.map((c) => {
                  const v = liv.get(c.id);
                  return (
                    <td key={c.id} className="px-4 py-3 tabular-nums bg-zinc-900/30">
                      {v != null ? `${v} m` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500 bg-zinc-900/30">AQI</td>
                {condos.map((c) => (
                  <td key={c.id} className="px-4 py-3 tabular-nums bg-zinc-900/30">
                    {c.aqi_score ?? "—"}
                    {c.pm25_value != null && <span className="text-zinc-500 text-xs"> ({c.pm25_value.toFixed(0)} pm2.5)</span>}
                  </td>
                ))}
              </tr>

              {/* Foreign buyer-specific */}
              <tr><td className="px-4 py-3 text-zinc-500">Ownership</td>
                {condos.map((c) => <td key={c.id} className="px-4 py-3 text-zinc-300">{c.building_ownership ?? "—"}</td>)}
              </tr>
              <tr><td className="px-4 py-3 text-zinc-500">Foreign quota share</td>
                {condos.map((c) => (
                  <td key={c.id} className="px-4 py-3 tabular-nums">
                    {c.foreign_quota_inventory_pct != null ? `${c.foreign_quota_inventory_pct.toFixed(0)}%` : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-zinc-500 leading-relaxed">
        ★ highlights the best value in each row. Yield + spread are pre-tax,
        pre-vacancy. Foreign quota share = % of currently-listed units tagged
        Foreign Quota on FazWaz; sold-quota status is not visible — confirm at
        the sales office.
      </p>
    </main>
  );
}
