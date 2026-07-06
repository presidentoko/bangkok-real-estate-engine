"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type CondoSearchResult = {
  id: string;
  name: string;
  developer: string | null;
  regions?: { name: string } | { name: string }[] | null;
};

const PLATFORMS = ["youtube", "blog", "instagram", "tiktok", "news", "other"];

function regionLabel(r: CondoSearchResult["regions"]): string {
  if (!r) return "—";
  const v = Array.isArray(r) ? r[0] : r;
  return v?.name ?? "—";
}

export function PromotionForm() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CondoSearchResult[]>([]);
  const [picked, setPicked] = useState<CondoSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [promotedBy, setPromotedBy] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [promotionUrl, setPromotionUrl] = useState("");
  const [claim, setClaim] = useState("");
  const [promotedAt, setPromotedAt] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { ok: true; id: string } | { ok: false; message: string } | null
  >(null);

  // Debounced condo search.
  const searchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (!query || query.length < 2 || picked) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/condos/search?q=${encodeURIComponent(query)}`
        );
        const j = await r.json();
        setResults(j.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query, picked]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!picked) {
      setResult({ ok: false, message: "Pick a condo first" });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No admin secret here — this form only renders behind the
        // /admin/* middleware gate, so the httpOnly admin_session cookie
        // (set at /admin/login) is sent automatically and verified
        // server-side by checkAdminAuth(). Nothing sensitive touches
        // client JS or localStorage.
        body: JSON.stringify({
          condo_id: picked.id,
          promoted_by: promotedBy.trim(),
          platform,
          promotion_url: promotionUrl.trim() || undefined,
          claim: claim.trim() || undefined,
          promoted_at: promotedAt || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResult({ ok: false, message: j.error ?? `HTTP ${r.status}` });
      } else {
        setResult({ ok: true, id: j.id });
        setPromotedBy("");
        setPromotionUrl("");
        setClaim("");
        setPromotedAt("");
        setPicked(null);
        setQuery("");
      }
    } catch (e) {
      setResult({
        ok: false,
        message: e instanceof Error ? e.message : "request failed",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Condo</label>
        {picked ? (
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-900 rounded-lg px-3 py-2">
            <div>
              <div className="font-semibold">{picked.name}</div>
              <div className="text-xs text-zinc-400">
                {regionLabel(picked.regions)} · {picked.developer ?? "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setQuery("");
              }}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              change
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type condo name to search"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
            />
            {searching && (
              <div className="text-xs text-zinc-500 mt-1">searching…</div>
            )}
            {results.length > 0 && (
              <ul className="mt-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(r)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-800"
                    >
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-zinc-500">
                        {regionLabel(r.regions)} · {r.developer ?? "—"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Promoted by</label>
          <input
            required
            value={promotedBy}
            onChange={(e) => setPromotedBy(e.target.value)}
            placeholder="채널/블로그명"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">URL</label>
        <input
          type="url"
          value={promotionUrl}
          onChange={(e) => setPromotionUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Marketing claim (한 줄)
        </label>
        <input
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder='예: "지금 사면 무조건 오른다"'
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Promoted at</label>
        <input
          type="date"
          value={promotedAt}
          onChange={(e) => setPromotedAt(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono"
        />
      </div>

      <button
        type="submit"
        disabled={busy || !picked || !promotedBy.trim()}
        className="w-full py-3 rounded-2xl bg-pink-500 hover:bg-pink-400 disabled:opacity-50 font-semibold text-white transition"
      >
        {busy ? "Saving…" : "Add promotion"}
      </button>

      {result && (
        <div
          className={`text-sm rounded-lg p-3 ${
            result.ok
              ? "bg-emerald-950/50 text-emerald-300 border border-emerald-900"
              : "bg-red-950/50 text-red-300 border border-red-900"
          }`}
        >
          {result.ok ? `✅ saved (id: ${result.id})` : result.message}
        </div>
      )}
    </form>
  );
}
