"use client";

import { useState } from "react";

type InquiryType = "property" | "advertising";

const BUDGETS = [
  { label: "Under ฿3M", min: null, max: 3_000_000 },
  { label: "฿3–5M", min: 3_000_000, max: 5_000_000 },
  { label: "฿5–10M", min: 5_000_000, max: 10_000_000 },
  { label: "฿10–20M", min: 10_000_000, max: 20_000_000 },
  { label: "฿20M+", min: 20_000_000, max: null },
] as const;

const TIMELINES = [
  { value: "now", label: "Within 1 month" },
  { value: "3mo", label: "1–3 months" },
  { value: "6mo", label: "3–6 months" },
  { value: "12mo", label: "6–12 months" },
  { value: "browsing", label: "Just browsing" },
] as const;

const PURPOSES = [
  { value: "own", label: "Own / live in" },
  { value: "rent_invest", label: "Rent out / yield" },
  { value: "flip", label: "Flip / capital gain" },
  { value: "undecided", label: "Not sure yet" },
] as const;

export function ContactForm() {
  const [type, setType] = useState<InquiryType>("property");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [budget, setBudget] = useState(-1);
  const [timeline, setTimeline] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErrorMsg(null);
    try {
      const b = budget >= 0 ? BUDGETS[budget] : null;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiry_type: type,
          email: email.trim(),
          phone: phone.trim() || undefined,
          line_id: lineId.trim() || undefined,
          budget_min: b?.min ?? undefined,
          budget_max: b?.max ?? undefined,
          timeline: timeline || undefined,
          purpose: purpose || undefined,
          message: message.trim() || undefined,
          referrer: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Submission failed");
      }
      setState("ok");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (state === "ok") {
    return (
      <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">✓</div>
        <p className="text-emerald-200 font-semibold">Message received — we&apos;ll be in touch.</p>
        <p className="text-emerald-300/60 text-sm mt-1">Usually within a few hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Inquiry type toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType("property")}
          className={`py-3 px-4 rounded-xl text-left border transition ${
            type === "property"
              ? "bg-emerald-500 border-emerald-500 text-zinc-950"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <div className="font-semibold text-sm">🏡 Concierge</div>
          <div className={`text-xs mt-0.5 ${type === "property" ? "text-zinc-800" : "text-zinc-600"}`}>
            Property price, shortlist, viewing
          </div>
        </button>
        <button
          type="button"
          onClick={() => setType("advertising")}
          className={`py-3 px-4 rounded-xl text-left border transition ${
            type === "advertising"
              ? "bg-emerald-500 border-emerald-500 text-zinc-950"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <div className="font-semibold text-sm">📋 Operations</div>
          <div className={`text-xs mt-0.5 ${type === "advertising" ? "text-zinc-800" : "text-zinc-600"}`}>
            Advertising, media, data
          </div>
        </button>
      </div>

      {/* Contact fields */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            Email <span className="text-rose-400">*</span>
          </span>
          <input
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Phone</span>
            <input
              type="tel"
              maxLength={50}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+66 8x xxx xxxx"
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-400 uppercase tracking-wider">LINE ID</span>
            <input
              type="text"
              maxLength={100}
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              placeholder="@yourlineid"
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
            />
          </label>
        </div>
      </div>

      {/* Property-specific fields */}
      {type === "property" && (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
              Budget <span className="text-zinc-600 normal-case tracking-normal">— optional</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b, i) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setBudget(budget === i ? -1 : i)}
                  className={`text-sm px-3.5 py-2 rounded-full border transition ${
                    budget === i
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
              Timeline <span className="text-zinc-600 normal-case tracking-normal">— optional</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIMELINES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTimeline(timeline === t.value ? "" : t.value)}
                  className={`text-sm px-3.5 py-2 rounded-full border transition ${
                    timeline === t.value
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">
              Purpose <span className="text-zinc-600 normal-case tracking-normal">— optional</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPurpose(purpose === p.value ? "" : p.value)}
                  className={`text-sm px-3.5 py-2 rounded-full border transition ${
                    purpose === p.value
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Message */}
      <label className="block">
        <span className="text-xs text-zinc-400 uppercase tracking-wider">
          {type === "property" ? "Anything specific?" : "Message"}
          {type === "advertising" && <span className="text-rose-400"> *</span>}
          {type === "property" && (
            <span className="text-zinc-600 normal-case tracking-normal"> — optional</span>
          )}
        </span>
        <textarea
          required={type === "advertising"}
          rows={4}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            type === "property"
              ? "Which condo / area are you looking at?"
              : "Tell us about your company and goals."
          }
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500 resize-y"
        />
      </label>

      {errorMsg && <p className="text-rose-400 text-sm">{errorMsg}</p>}

      <button
        type="submit"
        disabled={state === "sending" || email.length === 0}
        className="w-full py-3 bg-emerald-500 text-zinc-950 rounded-xl font-semibold hover:bg-emerald-400 transition disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
