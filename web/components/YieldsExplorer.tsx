"use client";

// Client half of the /yields page. The server component renders the DEFAULT
// view (all Thailand, sorted by yield) statically; this component reads the
// ?province / ?sort / ?min_yield params after hydration and, when they differ
// from the default, fetches the filtered rows from /api/yields and re-renders
// the table client-side. Bots crawling the ~30 parameter permutations all get
// the same cached static shell — zero function invocations.
//
// The chips are plain <a> links (full navigation), so a click always lands on
// the static shell and re-runs the mount effect; rel="nofollow" keeps crawlers
// from treating the permutations as canonical content.

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtTHB } from "@/lib/fmt";
import {
  clampMinYield,
  DEFAULT_MIN_YIELD,
  resolveYieldSort,
  YIELD_PROVINCES,
  YIELD_SORT_OPTIONS,
  yieldRegionLabel,
  type YieldRow,
} from "@/lib/yields";

type Filters = { province: string; sortKey: string; minYield: number };

const DEFAULT_FILTERS: Filters = {
  province: "all",
  sortKey: "yield",
  minYield: DEFAULT_MIN_YIELD,
};

function isDefault(f: Filters): boolean {
  return (
    f.province === DEFAULT_FILTERS.province &&
    f.sortKey === DEFAULT_FILTERS.sortKey &&
    f.minYield === DEFAULT_FILTERS.minYield
  );
}

export function YieldsExplorer({
  lang,
  initialRows,
  mrr,
}: {
  lang: string;
  initialRows: YieldRow[];
  mrr: number | null;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rows, setRows] = useState<YieldRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Read the query string once on mount. Chip links are full navigations, so
  // every filter change re-mounts this component with the new params.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next: Filters = {
      province:
        YIELD_PROVINCES.find((p) => p.slug === sp.get("province"))?.slug ?? "all",
      sortKey: resolveYieldSort(sp.get("sort")).key,
      minYield: clampMinYield(sp.get("min_yield")),
    };
    if (isDefault(next)) return;
    setFilters(next);

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const qs = new URLSearchParams();
    if (next.province !== "all") qs.set("province", next.province);
    if (next.sortKey !== "yield") qs.set("sort", next.sortKey);
    if (next.minYield !== DEFAULT_MIN_YIELD) qs.set("min_yield", String(next.minYield));
    fetch(`/api/yields?${qs.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { rows?: YieldRow[] }) => {
        if (!cancelled) setRows(data.rows ?? []);
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

  const { province, sortKey, minYield } = filters;

  function chipHref(nextProvince: string, nextSort: string): string {
    const qs = new URLSearchParams();
    if (nextProvince !== "all") qs.set("province", nextProvince);
    if (nextSort !== "yield") qs.set("sort", nextSort);
    if (minYield !== DEFAULT_MIN_YIELD) qs.set("min_yield", String(minYield));
    const q = qs.toString();
    return q ? `/${lang}/yields?${q}` : `/${lang}/yields`;
  }

  return (
    <>
      <nav className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Province</span>
          {YIELD_PROVINCES.map((p) => {
            const active = province === p.slug;
            return (
              <a
                key={p.slug}
                href={chipHref(p.slug, sortKey)}
                rel="nofollow"
                className={`px-3.5 py-2 rounded-full border transition ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p.label}
              </a>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs text-zinc-500 uppercase tracking-wider mr-1">Sort</span>
          {YIELD_SORT_OPTIONS.map((s) => {
            const active = sortKey === s.key;
            return (
              <a
                key={s.key}
                href={chipHref(province, s.key)}
                rel="nofollow"
                className={`px-3.5 py-2 rounded-full border text-xs transition ${
                  active
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s.label}
              </a>
            );
          })}
        </div>
      </nav>

      {loadError ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-rose-400 text-sm">
          Couldn’t load this filter.{" "}
          <a href={`/${lang}/yields`} className="underline underline-offset-2">
            Back to the full ranking
          </a>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
          No condos with computed yield in this filter yet. Yields require
          matched sale + rent listings on the same building.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards. Below sm the table overflows badly. */}
          <ul className="sm:hidden space-y-2">
            {rows.map((r, i) => {
              const spread = mrr != null ? r.gross_yield_pct - mrr : null;
              return (
                <li
                  key={r.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3"
                >
                  <Link
                    href={`/${lang}/condo/${r.slug ?? r.id}`}
                    className="block space-y-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-zinc-600 tabular-nums text-xs w-6 shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-zinc-100 font-medium leading-snug">
                        {r.name}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 pl-8 flex-wrap">
                      <span className="text-zinc-400 capitalize text-xs">
                        {yieldRegionLabel(r)}
                      </span>
                      <span className="font-semibold tabular-nums text-base">
                        {r.gross_yield_pct.toFixed(2)}%
                      </span>
                      {spread != null && (
                        <span
                          className={`text-xs font-semibold tabular-nums ${
                            spread >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {spread >= 0 ? "+" : ""}
                          {spread.toFixed(2)}pp
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3 pl-8 text-xs text-zinc-500 tabular-nums">
                      <span>Sale {fmtTHB(r.avg_sale_price)}</span>
                      <span>· Rent {fmtTHB(r.avg_monthly_rent)}/mo</span>
                      <span>
                        · n={r.yield_sample_sale ?? 0}/{r.yield_sample_rent ?? 0}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Tablet+: full table. */}
          <div className="hidden sm:block rounded-2xl border border-zinc-800 bg-zinc-950 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-4 py-3">Condo</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-right px-4 py-3">Yield</th>
                {mrr != null && (
                  <th className="text-right px-4 py-3">Spread</th>
                )}
                <th className="text-right px-4 py-3">Avg sale</th>
                <th className="text-right px-4 py-3">Avg rent</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">n</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const spread = mrr != null ? r.gross_yield_pct - mrr : null;
                return (
                  <tr key={r.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${lang}/condo/${r.slug ?? r.id}`}
                        className="text-zinc-100 hover:underline font-medium"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 capitalize">{yieldRegionLabel(r)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {r.gross_yield_pct.toFixed(2)}%
                    </td>
                    {mrr != null && (
                      <td
                        className={`px-4 py-3 text-right font-semibold tabular-nums ${
                          spread != null && spread >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {spread != null
                          ? `${spread >= 0 ? "+" : ""}${spread.toFixed(2)}pp`
                          : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(r.avg_sale_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtTHB(r.avg_monthly_rent)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs hidden sm:table-cell">
                      {r.yield_sample_sale ?? 0}/{r.yield_sample_rent ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </>
  );
}
