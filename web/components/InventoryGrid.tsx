"use client";

import { useMemo, useState } from "react";
import { BuildingCard } from "@/components/BuildingCard";
import type { CondoSummary, PropertyType } from "@/lib/queries/condos";

type SortKey = "default" | "bubble_low" | "bubble_high" | "year" | "name";
type TypeFilter = "all" | PropertyType;

const SORT_LABELS: Record<SortKey, string> = {
  default: "Featured",
  bubble_low: "Bubble — low first",
  bubble_high: "Bubble — high first",
  year: "Newest built",
  name: "Name (A→Z)",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  condo: "Condo",
  apartment: "Apartment",
  "serviced-apartment": "Serviced",
};

export function InventoryGrid({
  condos,
  hrefPrefix,
  districts,
}: {
  condos: CondoSummary[];
  hrefPrefix: string;
  districts: string[];
}) {
  const [q, setQ] = useState("");
  const [district, setDistrict] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("default");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Only render type chips for types that actually exist in the dataset.
  const availableTypes = useMemo(() => {
    const set = new Set<PropertyType>();
    for (const c of condos) set.add(c.property_type);
    const order: TypeFilter[] = ["all", "condo", "apartment", "serviced-apartment"];
    return order.filter((t) => t === "all" || set.has(t as PropertyType));
  }, [condos]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = condos.filter((c) => {
      if (typeFilter !== "all" && c.property_type !== typeFilter) return false;
      if (district && c.region !== district) return false;
      if (photoOnly && !c.hero_image_url) return false;
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
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
        // total_units doesn't carry year; this is a placeholder for completion_year
        // when we wire it through queries. Falls back to default order.
        arr = [...arr].sort((a, b) => (b.total_units ?? 0) - (a.total_units ?? 0));
        break;
      default:
        // Featured: super value first, then with photo, then with bubble data.
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
  }, [condos, q, district, sort, photoOnly, typeFilter]);

  return (
    <div className="space-y-5">
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {availableTypes.map((t) => (
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
        <span className="text-xs text-zinc-500 ml-auto tabular-nums">
          {filtered.length.toLocaleString()} / {condos.length.toLocaleString()}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-zinc-500 py-16 text-sm">No matches.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <BuildingCard key={c.id} condo={c} hrefPrefix={hrefPrefix} />
          ))}
        </div>
      )}
    </div>
  );
}
