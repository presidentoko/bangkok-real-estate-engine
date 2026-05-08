"use client";

import { useMemo, useState } from "react";

type Unit = {
  listing_type: string;
  price: number;
  currency: string;
  area_sqm: number | null;
  price_per_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_level: number | null;
  publisher: string | null;
  listing_url: string | null;
  source_unit_id: string | null;
};

function fmt(n: number | null | undefined, prefix = ""): string {
  if (n == null) return "—";
  return `${prefix}${Math.round(n).toLocaleString()}`;
}

export function CondoUnitsTable({ listings }: { listings: Unit[] }) {
  const tabs = useMemo(() => {
    const has = new Set(listings.map((l) => l.listing_type));
    const out: ("sale" | "rent")[] = [];
    if (has.has("sale")) out.push("sale");
    if (has.has("rent")) out.push("rent");
    return out;
  }, [listings]);

  const [tab, setTab] = useState<"sale" | "rent">(tabs[0] ?? "sale");

  const filtered = listings
    .filter((l) => l.listing_type === tab)
    .sort((a, b) => (a.price_per_sqm ?? 0) - (b.price_per_sqm ?? 0));

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">
          Available units{" "}
          <span className="text-zinc-500 text-xs">({listings.length})</span>
        </h2>
        {tabs.length > 1 && (
          <div className="flex gap-1 text-xs">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2 py-1 rounded transition ${
                  tab === t
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {t === "sale" ? "Sale" : "Rent"}{" "}
                <span className="opacity-60">
                  {listings.filter((l) => l.listing_type === t).length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider">
              <th className="font-normal py-2 pr-3">Price</th>
              <th className="font-normal py-2 pr-3">/sqm</th>
              <th className="font-normal py-2 pr-3 text-center">Bd</th>
              <th className="font-normal py-2 pr-3 text-center">Ba</th>
              <th className="font-normal py-2 pr-3 text-right">Size</th>
              <th className="font-normal py-2 pr-3 text-center">Floor</th>
              <th className="font-normal py-2 pr-3">Publisher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((u, i) => {
              const cur = u.currency || "USD";
              const row = (
                <>
                  <td className="py-2 pr-3 font-semibold tabular-nums">
                    {cur} {fmt(u.price)}
                    {tab === "rent" && (
                      <span className="text-zinc-500 font-normal text-xs">/mo</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-400">
                    {fmt(u.price_per_sqm)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-center">
                    {u.bedrooms ?? "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-center">
                    {u.bathrooms ?? "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-right">
                    {u.area_sqm ? `${u.area_sqm} m²` : "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-center">
                    {u.floor_level ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400 truncate max-w-[140px]">
                    {u.publisher ?? "—"}
                  </td>
                </>
              );
              return u.listing_url ? (
                <tr
                  key={u.source_unit_id ?? i}
                  className="hover:bg-zinc-800/40 cursor-pointer"
                  onClick={() => window.open(u.listing_url!, "_blank", "noopener,noreferrer")}
                >
                  {row}
                </tr>
              ) : (
                <tr key={u.source_unit_id ?? i}>{row}</tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-zinc-600 mt-3">
        Click row to open the publisher listing on hipflat. Sorted by price/sqm asc.
      </div>
    </section>
  );
}
