"use client";

import { useEffect, useMemo, useState } from "react";
import { BuildingCard } from "@/components/BuildingCard";
import { decodeCompact, isCompact } from "@/lib/condo-compact";
import type { InventoryStats } from "@/lib/inventory";
import type { CondoSummary, PropertyType } from "@/lib/queries/condos";

type SortKey = "default" | "bubble_low" | "bubble_high" | "year" | "name";
type TypeFilter = "all" | PropertyType;
type BubbleBucket = "all" | "under" | "market" | "premium" | "bubble";

const SORT_LABELS: Record<SortKey, string> = {
  default: "Featured",
  bubble_low: "Bubble — low first",
  bubble_high: "Bubble — high first",
  year: "Most units",
  name: "Name (A→Z)",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  condo: "Condo",
  apartment: "Apartment",
  "serviced-apartment": "Serviced",
};

const BUBBLE_LABELS: Record<BubbleBucket, string> = {
  all: "Any price",
  under: "Underpriced (<90)",
  market: "At market (90–130)",
  premium: "Premium (131–200)",
  bubble: "Bubble (>200)",
};

// How many cards to actually paint at once. The lazy-fetch pulls the full
// city set (Bangkok = thousands), but rendering every BuildingCard in one go
// froze the main thread for seconds (each card is a Link + <img> + badges, so
// thousands of them = thousands of DOM image subtrees + a giant React commit)
// — the page looked stuck on the loading skeletons. We filter/sort the full
// set but only paint a window of it, growing on demand via "Show more".
const PAGE_SIZE = 60;

function fmtMoney(n: number | null, currency: string | null | undefined): string {
  if (n == null) return "—";
  const sym = currency === "THB" ? "฿" : currency === "USD" ? "$" : `${currency ?? ""} `;
  if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${sym}${(n / 1_000).toFixed(0)}k`;
  return `${sym}${Math.round(n).toLocaleString()}`;
}

export function InventoryGrid({
  citySlug,
  hrefPrefix,
  districts,
  cityLabel,
  totalCount,
  stats,
  topPicks,
  availableTypes,
}: {
  citySlug: string;
  hrefPrefix: string;
  districts: string[];
  cityLabel: string;
  totalCount: number;
  stats: InventoryStats;
  topPicks: CondoSummary[];
  availableTypes: PropertyType[];
}) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("default");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bubble, setBubble] = useState<BubbleBucket>("all");
  const [revealAll, setRevealAll] = useState(false);

  // The full city-scoped condo set is NOT passed as a prop (it would bloat the
  // initial payload). We lazy-fetch it from the API the first time the user
  // opens the grid, then filter/sort it on the client as before.
  const [loaded, setLoaded] = useState<CondoSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // How many of the filtered results are currently painted (windowed render).
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const typeChips: TypeFilter[] = ["all", ...availableTypes];

  const isFiltering =
    q.trim().length > 0 ||
    district !== "" ||
    typeFilter !== "all" ||
    bubble !== "all" ||
    photoOnly;

  // The grid is "open" once the user filters/searches OR clicks "Show all".
  const showGrid = isFiltering || revealAll;

  // Fetch the full set the first time the grid opens.
  useEffect(() => {
    if (!showGrid || loaded !== null || loading) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetch(`/api/condos/inventory?city=${encodeURIComponent(citySlug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        // New payload is compact (columnar); a stale CDN entry served right
        // after deploy may still be the legacy `{ condos: [...] }` shape.
        if (isCompact(data)) {
          setLoaded(decodeCompact(data));
        } else {
          setLoaded((data as { condos?: CondoSummary[] }).condos ?? []);
        }
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
  }, [showGrid, loaded, loading, citySlug]);

  const filtered = useMemo(() => {
    if (!loaded) return [];
    const needle = q.trim().toLowerCase();
    let arr = loaded.filter((c) => {
      if (typeFilter !== "all" && c.property_type !== typeFilter) return false;
      if (district && c.region !== district) return false;
      if (photoOnly && !c.hero_image_url) return false;
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      if (bubble !== "all") {
        const b = c.bubble_index;
        if (b == null) return false;
        if (bubble === "under" && b >= 90) return false;
        if (bubble === "market" && (b < 90 || b > 130)) return false;
        if (bubble === "premium" && (b < 131 || b > 200)) return false;
        if (bubble === "bubble" && b <= 200) return false;
      }
      return true;
    });
    switch (sort) {
      case "bubble_low":
        arr = arr
          .filter((c) => c.bubble_index != null)
          .sort((a, b) => (a.bubble_index ?? 0) - (b.bubble_index ?? 0));
        break;
      case "bubble_high":
        arr = arr
          .filter((c) => c.bubble_index != null)
          .sort((a, b) => (b.bubble_index ?? 0) - (a.bubble_index ?? 0));
        break;
      case "name":
        arr = [...arr].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "year":
        arr = [...arr].sort((a, b) => (b.total_units ?? 0) - (a.total_units ?? 0));
        break;
      default:
        arr = [...arr].sort((a, b) => {
          const score = (c: CondoSummary) =>
            (c.is_super_value ? 1000 : 0) +
            (c.hero_image_url ? 100 : 0) +
            (c.bubble_index != null ? 10 : 0) +
            (c.flood_risk_level != null ? 1 : 0);
          return score(b) - score(a);
        });
    }
    return arr;
  }, [loaded, q, district, sort, photoOnly, typeFilter, bubble]);

  // Any change to the result set (new filter/sort, or freshly loaded data)
  // resets the window back to the first page so the user isn't scrolled past
  // a now-shorter list.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [loaded, q, district, sort, photoOnly, typeFilter, bubble]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visible.length;

  function clearFilters() {
    setQ("");
    setDistrict("");
    setTypeFilter("all");
    setBubble("all");
    setPhotoOnly(false);
    setRevealAll(false);
  }

  return (
    <div className="space-y-6">
      {/* ---- Stats dashboard ---- */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
          {cityLabel} · inventory snapshot
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Stat label="Buildings" value={totalCount.toLocaleString()} />
          <Stat label="Districts" value={districts.length.toLocaleString()} />
          <Stat
            label="Geo-located"
            value={stats.geoLocated.toLocaleString()}
            sub={`${totalCount ? Math.round((stats.geoLocated / totalCount) * 100) : 0}%`}
          />
          <Stat label="Median sale" value={fmtMoney(stats.saleMedian, stats.currency)} />
          <Stat label="Median rent / mo" value={fmtMoney(stats.rentMedian, stats.currency)} />
          <Stat
            label="Bubble avg"
            value={stats.bubbleAvg != null ? stats.bubbleAvg.toFixed(0) : "—"}
            sub={stats.bubbleSampleSize > 0 ? `${stats.bubbleSampleSize.toLocaleString()} scored` : undefined}
            tint={
              stats.bubbleAvg == null
                ? "text-zinc-400"
                : stats.bubbleAvg > 130
                ? "text-rose-300"
                : stats.bubbleAvg < 90
                ? "text-emerald-300"
                : "text-zinc-200"
            }
          />
        </div>
        {stats.superValue > 0 && (
          <div className="mt-3 text-xs text-emerald-300">
            ★ {stats.superValue.toLocaleString()} super-value picks · scored under market
          </div>
        )}
      </div>

      {/* ---- Filters ---- */}
      <div className="space-y-3">
        {typeChips.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {typeChips.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                  typeFilter === t
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {(["all", "under", "market", "premium", "bubble"] as BubbleBucket[]).map((b) => {
            const active = bubble === b;
            const tint =
              b === "under" ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
              : b === "premium" ? "bg-orange-500/20 text-orange-200 border-orange-500/40"
              : b === "bubble" ? "bg-rose-500/20 text-rose-200 border-rose-500/40"
              : "bg-zinc-900 text-zinc-300 border-zinc-800";
            return (
              <button
                key={b}
                onClick={() => setBubble(b)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition border ${
                  active
                    ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                    : `${tint} hover:border-zinc-500`
                }`}
              >
                {BUBBLE_LABELS[b]}
              </button>
            );
          })}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search building name…"
            className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
          >
            <option value="">All districts ({districts.length})</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
          >
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-zinc-300 px-2">
            <input
              type="checkbox"
              checked={photoOnly}
              onChange={(e) => setPhotoOnly(e.target.checked)}
              className="accent-blue-500"
            />
            Photo only
          </label>
          {isFiltering && (
            <button
              onClick={clearFilters}
              className="text-xs text-zinc-400 hover:text-zinc-100 underline underline-offset-2"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-zinc-500 ml-auto tabular-nums">
            {showGrid
              ? loaded
                ? `${filtered.length.toLocaleString()} / ${totalCount.toLocaleString()}`
                : "loading…"
              : `${totalCount.toLocaleString()} total`}
          </span>
        </div>
      </div>

      {/* ---- Default state: top picks + invitation to filter ---- */}
      {!showGrid && (
        <>
          {topPicks.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Super-value picks
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Scored under market — best yields right now
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topPicks.map((c) => (
                  <BuildingCard key={c.id} condo={c} hrefPrefix={hrefPrefix} />
                ))}
              </div>
            </section>
          )}

          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-zinc-400 text-sm mb-3">
              {totalCount.toLocaleString()} buildings in {cityLabel}.
              <br />
              Search by name or pick a filter above to drill in.
            </div>
            <button
              onClick={() => setRevealAll(true)}
              className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Show all {totalCount.toLocaleString()} →
            </button>
          </div>
        </>
      )}

      {/* ---- Filtered or full grid ---- */}
      {showGrid && (
        loadError ? (
          <div className="text-center text-rose-400 py-16 text-sm">
            Couldn’t load inventory.{" "}
            <button
              onClick={() => {
                setLoadError(false);
                setLoaded(null);
              }}
              className="underline underline-offset-2 hover:text-rose-300"
            >
              Retry
            </button>
          </div>
        ) : !loaded ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[5/3] bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-zinc-500 py-16 text-sm">No matches.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((c) => (
                <BuildingCard key={c.id} condo={c} hrefPrefix={hrefPrefix} />
              ))}
            </div>
            {hasMore && (
              <div className="flex flex-col items-center gap-2 pt-6">
                <div className="text-xs text-zinc-500 tabular-nums">
                  Showing {visible.length.toLocaleString()} of{" "}
                  {filtered.length.toLocaleString()}
                </div>
                <button
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium px-5 py-2.5 rounded-lg transition"
                >
                  Show more →
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  tint?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-2xl font-black tabular-nums ${tint ?? "text-zinc-100"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-zinc-500 tabular-nums">{sub}</div>}
    </div>
  );
}
