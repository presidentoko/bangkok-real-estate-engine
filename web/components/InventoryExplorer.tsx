"use client";

// Client half of the /inventory page. The server component renders the
// DEFAULT city (Bangkok) statically — header, stats dashboard, districts,
// top picks — all computed server-side from a cheap city-scoped fetch. This
// component reads ?city= after hydration and, when it differs from Bangkok,
// fetches the full compact condo set for that city from /api/condos/inventory
// and recomputes the same aggregates client-side using the same pure helpers
// the server used (lib/inventory.ts). Bots crawling the ~9 city permutations
// all get the identical cached static shell — zero function invocations.
//
// City chips are plain <a> links (full navigation), so a click always lands
// on the static shell and re-runs the mount effect; rel="nofollow" keeps
// crawlers from treating the permutations as canonical content.

import Link from "next/link";
import { useEffect, useState } from "react";
import { InventoryGrid } from "@/components/InventoryGrid";
import { canonicalCitySlug, getCity } from "@/lib/cities";
import { decodeCompact, isCompact } from "@/lib/condo-compact";
import {
  availablePropertyTypes,
  computeInventoryStats,
  extractDistricts,
  topPicks as computeTopPicks,
  type InventoryStats,
} from "@/lib/inventory";
import type { CondoSummary, PropertyType } from "@/lib/queries/condos";

const BANGKOK_LABEL: Record<string, string> = {
  en: "Bangkok",
  ko: "방콕",
  th: "กรุงเทพ",
};

export type CityChip = { slug: string; name: string; count: number; href: string };

export type CityView = {
  slug: string;
  name: string;
  totalCount: number;
  districts: string[];
  stats: InventoryStats;
  picks: CondoSummary[];
  availableTypes: PropertyType[];
};

function resolveCityName(slug: string, lang: string): string {
  if (slug === "bangkok") return BANGKOK_LABEL[lang] ?? "Bangkok";
  const city = getCity(slug);
  if (!city) return BANGKOK_LABEL[lang] ?? "Bangkok";
  return (city.name as Record<string, string>)[lang] ?? city.name.en;
}

export function InventoryExplorer({
  lang,
  cityChips,
  initial,
}: {
  lang: string;
  cityChips: CityChip[];
  initial: CityView;
}) {
  const [view, setView] = useState<CityView>(initial);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Read the query string once on mount. Chip links are full navigations, so
  // every city change re-mounts this component with the new params.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cityParam = sp.get("city");
    if (!cityParam) return;
    const target = canonicalCitySlug(cityParam);
    if (target === initial.slug) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetch(`/api/condos/inventory?city=${encodeURIComponent(target)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const condos = isCompact(data)
          ? decodeCompact(data)
          : ((data as { condos?: CondoSummary[] }).condos ?? []);
        setView({
          slug: target,
          name: resolveCityName(target, lang),
          totalCount: condos.length,
          districts: extractDistricts(condos),
          stats: computeInventoryStats(condos),
          picks: computeTopPicks(condos),
          availableTypes: availablePropertyTypes(condos),
        });
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
  }, [initial.slug, lang]);

  const cityName = view.name;

  return (
    <>
      <header>
        <Link
          href={`/${lang}`}
          className="text-zinc-500 hover:text-zinc-300 text-sm inline-block"
        >
          ← back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
          {cityName} <span className="text-zinc-500">inventory</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {view.totalCount.toLocaleString("en-US")} condo buildings tracked across 4 portals
          {view.slug !== "bangkok" ? ` in ${cityName}` : " in Thailand's capital"}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {cityChips.map((c) => {
            const active = c.slug === view.slug;
            const empty = c.count === 0;
            // A 0-count chip used to render as a normal link that took the
            // user to an empty page. Make it non-clickable so the navigation
            // signals "nothing here yet" instead of dead-ending.
            if (empty && !active) {
              return (
                <span
                  key={c.slug}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border border-zinc-900 bg-zinc-950 text-zinc-600 cursor-not-allowed"
                  title={`No inventory indexed for ${c.name} yet`}
                >
                  <span>{c.name}</span>
                  <span className="tabular-nums">0</span>
                </span>
              );
            }
            return (
              <a
                key={c.slug}
                href={c.href}
                rel="nofollow"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition border ${
                  active
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <span className={active ? "font-semibold" : "text-zinc-200 font-medium"}>
                  {c.name}
                </span>
                <span className={active ? "tabular-nums opacity-80" : "text-zinc-500 tabular-nums"}>
                  {c.count.toLocaleString("en-US")}
                </span>
              </a>
            );
          })}
        </div>
      </header>

      {loadError ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-rose-400 text-sm">
          Couldn’t load this city.{" "}
          <a href={`/${lang}/inventory`} className="underline underline-offset-2">
            Back to Bangkok inventory
          </a>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[5/3] bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <InventoryGrid
          citySlug={view.slug}
          hrefPrefix={`/${lang}/condo/`}
          districts={view.districts}
          cityLabel={cityName}
          totalCount={view.totalCount}
          stats={view.stats}
          topPicks={view.picks}
          availableTypes={view.availableTypes}
        />
      )}
    </>
  );
}
