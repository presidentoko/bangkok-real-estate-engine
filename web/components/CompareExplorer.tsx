"use client";

// Client half of the /compare page. The server component renders a fully
// static empty-state shell (no searchParams read) — Reading ?a/?b/?c
// server-side previously opted the whole route out of ISR, meaning every
// shared comparison link became a live Function invocation + 4 Supabase
// queries. This component reads ?a/?b/?c after hydration and, when present,
// fetches the comparison rows from /api/condos/compare.

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { fmtTHB } from "@/lib/fmt";
import { parseCompareIds, regionName, type CompareData } from "@/lib/compare";

const EMPTY: CompareData = { condos: [], scores: {}, risks: {}, liv: {}, mrr: null };

export function CompareExplorer({ lang }: { lang: string }) {
  const [data, setData] = useState<CompareData>(EMPTY);
  const [hasIds, setHasIds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const ids = parseCompareIds((key) => sp.get(key));
    if (ids.length === 0) return;
    setHasIds(true);

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const qs = new URLSearchParams();
    const keys = ["a", "b", "c"] as const;
    ids.forEach((id, i) => qs.set(keys[i], id));
    fetch(`/api/condos/compare?${qs.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: CompareData) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-rose-400 text-sm">
        Couldn’t load this comparison.{" "}
        <a href={`/${lang}/compare`} className="underline underline-offset-2">
          Start over
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { condos, scores, risks, liv, mrr } = data;

  if (!hasIds || condos.length === 0) {
    return (
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
    );
  }

  return (
    <>
      {condos.length >= 2 && (
        <div className="flex justify-end">
          <CopyLinkButton />
        </div>
      )}
      <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 [&_tr>:first-child]:sticky [&_tr>:first-child]:left-0 [&_tr>:first-child]:z-10 [&_tbody_tr>:first-child]:bg-zinc-950 [&_thead_tr>:first-child]:bg-zinc-900 [&_tr>:first-child]:shadow-[1px_0_0_rgba(63,63,70,0.4)]">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 w-32 sm:w-40">Metric</th>
              {condos.map((c) => (
                <th key={c.id} className="text-left px-4 py-3">
                  <Link
                    href={`/${lang}/condo/${c.slug ?? c.id}`}
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
                const v = scores[c.id];
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
                const v = risks[c.id];
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
                const v = liv[c.id];
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
    </>
  );
}
