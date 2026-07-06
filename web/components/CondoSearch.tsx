"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SearchResult = {
  id: string;
  slug: string | null;
  name: string;
  developer: string | null;
  regions: { name: string } | { name: string }[] | null;
};

const PLACEHOLDER: Record<string, string> = {
  en: "Search condos…",
  ko: "콘도 검색…",
  th: "ค้นหาคอนโด…",
};

export function CondoSearch({ lang }: { lang: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch — 250ms after the last keystroke.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/condos/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        /* aborted or network */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Outside click closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const placeholder = PLACEHOLDER[lang] ?? PLACEHOLDER.en;

  return (
    <div ref={ref} className="relative w-full sm:w-56">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length >= 2) setOpen(true);
        }}
        onFocus={() => q.trim().length >= 2 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 rounded-lg pl-7 pr-2 py-1 text-base sm:text-xs focus:outline-none transition"
      />
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs pointer-events-none">
        ⌕
      </span>

      {open && q.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl shadow-black/40 z-50">
          {loading && results.length === 0 && (
            <div className="px-3 py-2 text-zinc-500 text-xs">…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-zinc-500 text-xs">No matches</div>
          )}
          {results.map((r) => {
            const region =
              (Array.isArray(r.regions) ? r.regions[0] : r.regions)?.name ?? "";
            return (
              <Link
                key={r.id}
                href={`/${lang}/condo/${r.slug ?? r.id}`}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 hover:bg-zinc-900 transition border-b border-zinc-900/60 last:border-b-0"
              >
                <div className="text-sm text-zinc-200 truncate">{r.name}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                  {region}
                  {r.developer ? ` · ${r.developer}` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
