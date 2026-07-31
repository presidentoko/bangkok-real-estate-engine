"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildingCard } from "@/components/BuildingCard";
import { decodeCompact, isCompact } from "@/lib/condo-compact";
import { getSaved, clearSaved } from "@/lib/saved-condos";
import type { CondoSummary } from "@/lib/queries/condos";

type Props = { lang: string };

export function SavedContent({ lang }: Props) {
  const [condos, setCondos] = useState<CondoSummary[] | null>(null); // null = loading

  useEffect(() => {
    const ids = getSaved();
    if (ids.length === 0) {
      setCondos([]);
      return;
    }
    fetch(`/api/condos/batch?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        setCondos(isCompact(data) ? decodeCompact(data) : []);
      })
      .catch(() => setCondos([]));
  }, []);

  const onClear = () => {
    clearSaved();
    setCondos([]);
  };

  if (condos === null) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl aspect-[5/4] animate-pulse" />
        ))}
      </div>
    );
  }

  if (condos.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400">
        <p className="text-2xl mb-2">🤍</p>
        <p className="mb-1">No saved condos yet.</p>
        <p className="text-sm text-zinc-500">
          Tap the{" "}
          <span className="text-rose-300 font-medium">Save</span> button on any
          condo page to add it here.
        </p>
        <Link
          href={`/${lang}/inventory`}
          className="mt-4 inline-block text-sm text-blue-400 hover:underline"
        >
          Browse condos →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">
          {condos.length} saved condo{condos.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-rose-400 transition"
        >
          Clear all
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {condos.map((c) => (
          <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} />
        ))}
      </div>
    </div>
  );
}
