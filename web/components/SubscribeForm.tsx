"use client";

import { useState, type FormEvent } from "react";

const ALL_DISTRICTS_LABEL = "All Bangkok districts";

export function SubscribeForm() {
  const [chatId, setChatId] = useState("");
  const [districts, setDistricts] = useState("");
  const [threshold, setThreshold] = useState("80");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const districtList = districts
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const r = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          districts: districtList,
          bubble_threshold: Number(threshold) || 80,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResult({ ok: false, message: j.error ?? `HTTP ${r.status}` });
      } else {
        setResult({
          ok: true,
          message:
            "Subscribed. You'll get a Telegram message the next time a listing in your filter drops under threshold.",
        });
        setChatId("");
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
        <label className="block text-sm font-medium mb-1">Telegram chat ID</label>
        <input
          required
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="e.g. 123456789"
          inputMode="numeric"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Districts <span className="text-zinc-500 font-normal">(optional)</span>
        </label>
        <input
          value={districts}
          onChange={(e) => setDistricts(e.target.value)}
          placeholder="Vadhana, Huai Khwang, Phaya Thai"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
        />
        <div className="text-xs text-zinc-500 mt-1">
          Comma-separated khet (canonical names). Leave empty for{" "}
          {ALL_DISTRICTS_LABEL}.
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Bubble Index threshold
        </label>
        <input
          type="number"
          min="50"
          max="100"
          step="1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 font-mono"
        />
        <div className="text-xs text-zinc-500 mt-1">
          Alert me when Bubble Index ≤ this value. 80 = ≥20% below district avg.
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || !chatId.trim()}
        className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 font-semibold text-emerald-950 transition"
      >
        {busy ? "Subscribing…" : "Subscribe"}
      </button>

      {result && (
        <div
          className={`text-sm rounded-lg p-3 ${
            result.ok
              ? "bg-emerald-950/50 text-emerald-300 border border-emerald-900"
              : "bg-red-950/50 text-red-300 border border-red-900"
          }`}
        >
          {result.message}
        </div>
      )}
    </form>
  );
}
