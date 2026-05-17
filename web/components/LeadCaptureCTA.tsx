"use client";

import { useState } from "react";

type Props = {
  condoId?: string;
  condoName?: string;
  /**
   * Optional headline override. Defaults to a condo-aware prompt when
   * condoName is provided, else a generic consultation prompt.
   */
  headline?: string;
};

const BUDGET_RANGES: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: "Under ฿3M",  min: null,       max: 3_000_000  },
  { label: "฿3–5M",      min: 3_000_000,  max: 5_000_000  },
  { label: "฿5–10M",     min: 5_000_000,  max: 10_000_000 },
  { label: "฿10–20M",    min: 10_000_000, max: 20_000_000 },
  { label: "฿20M+",      min: 20_000_000, max: null       },
];

const TIMELINES = [
  { value: "now",       label: "Within 1 month" },
  { value: "3mo",       label: "1–3 months" },
  { value: "6mo",       label: "3–6 months" },
  { value: "12mo",      label: "6–12 months" },
  { value: "browsing",  label: "Just browsing" },
] as const;

const PURPOSES = [
  { value: "own",         label: "Own / live in" },
  { value: "rent_invest", label: "Rent out / yield" },
  { value: "flip",        label: "Flip / capital gain" },
  { value: "undecided",   label: "Not sure yet" },
] as const;

export function LeadCaptureCTA({ condoId, condoName, headline }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState<number>(-1);  // index into BUDGET_RANGES
  const [timeline, setTimeline] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");        // honeypot

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const budgetRange = budget >= 0 ? BUDGET_RANGES[budget] : null;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condo_id: condoId,
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          budget_min: budgetRange?.min ?? undefined,
          budget_max: budgetRange?.max ?? undefined,
          timeline: timeline || undefined,
          purpose: purpose || undefined,
          message: message.trim() || undefined,
          source_url: typeof window !== "undefined" ? window.location.href : undefined,
          website,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-emerald-300 mb-1">
          Got it — we&apos;ll be in touch.
        </h2>
        <p className="text-sm text-emerald-300/80">
          A vetted broker will reach out within 24 hours with a tailored
          shortlist and an honest read on
          {condoName ? ` ${condoName}` : " the market"}. No spam.
        </p>
      </section>
    );
  }

  const defaultHeadline =
    headline ??
    (condoName
      ? `Considering ${condoName}? Get an expert opinion.`
      : "Want a human read on the Bangkok condo market?");

  return (
    <section className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-emerald-300">
            {defaultHeadline}
          </h2>
          <p className="text-sm text-emerald-300/70 mt-1">
            We pair you with a vetted broker who knows the building, the
            sub-market, and the foreign-quota status. We don&apos;t take
            commissions from developers; the broker pays us a flat
            referral.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition whitespace-nowrap"
          >
            Get expert opinion →
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                Email <span className="text-rose-400">*</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={200}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                Phone / LINE
              </span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={50}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                Timeline
              </span>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">—</option>
                {TIMELINES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">
              Budget
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_RANGES.map((r, i) => (
                <button
                  type="button"
                  key={r.label}
                  onClick={() => setBudget(i)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    budget === i
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">
              Purpose
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setPurpose(p.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
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

          <label className="block">
            <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
              Anything specific?
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Optional"
            />
          </label>

          {/* honeypot */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] w-px h-px opacity-0"
          />

          {error && (
            <p className="text-sm text-rose-400">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Request consultation"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-emerald-300/70 hover:text-emerald-300"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-emerald-300/50 leading-relaxed">
            By submitting, you agree we may share your contact with one
            vetted broker. We never sell email lists.
          </p>
        </form>
      )}
    </section>
  );
}
