"use client";

import Link from "next/link";
import { useState } from "react";

import { getDictionary } from "@/lib/getDictionary";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n";

type Props = {
  condoId?: string;
  condoName?: string;
  /** Locale for every label. Defaults to English so the ~9 call sites that
   *  predate localisation keep working rather than rendering undefined. */
  lang?: Lang | string;
  /**
   * Optional headline override. Defaults to a condo-aware prompt when
   * condoName is provided, else a generic consultation prompt.
   */
  headline?: string;
};

// Labels live in the dictionary and are matched to these by index, so the
// order of this array and of leadCta.budgetLabels must stay in step.
const BUDGET_RANGES: Array<{ min: number | null; max: number | null }> = [
  { min: null,       max: 3_000_000  },
  { min: 3_000_000,  max: 5_000_000  },
  { min: 5_000_000,  max: 10_000_000 },
  { min: 10_000_000, max: 20_000_000 },
  { min: 20_000_000, max: null       },
];

const TIMELINES = ["now", "3mo", "6mo", "12mo", "browsing"] as const;

const PURPOSES = ["own", "rent_invest", "flip", "undecided"] as const;

export function LeadCaptureCTA({ condoId, condoName, headline, lang }: Props) {
  const resolved: Lang = lang != null && isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDictionary(resolved).leadCta;
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
      setError(t.errEmail);
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
        setError(j.error ?? t.errSubmit);
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-emerald-300 mb-1">
          {t.doneTitle}
        </h2>
        <p className="text-sm text-emerald-300/80">
          {t.doneBodyA}
          {condoName ? ` ${condoName}` : ` ${t.doneBodyMarket}`}
          {t.doneBodyEnd}
        </p>
      </section>
    );
  }

  const defaultHeadline =
    headline ??
    (condoName ? t.headlineCondo(condoName) : t.headlineGeneric);

  return (
    <section className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-emerald-300">
            {defaultHeadline}
          </h2>
          <p className="text-sm text-emerald-300/70 mt-1">{t.sub}</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition whitespace-nowrap"
          >
            {t.openBtn}
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 space-y-4">
          {/* Step 1 — email only. The single required field, full-width
              so it's unmistakably the action. */}
          <label className="block">
            <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
              {t.emailLabel} <span className="text-rose-400">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              maxLength={200}
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
              placeholder={t.emailPh}
            />
          </label>

          {/* Step 2 — optional one-click qualifiers. Help the broker
              triage but never required. */}
          <div>
            <div className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">
              {t.budgetLabel}{" "}
              <span className="text-emerald-300/40 normal-case tracking-normal">
                {t.optional}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_RANGES.map((opt, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setBudget(budget === i ? -1 : i)}
                  className={`text-sm px-3.5 py-2 rounded-full border transition ${
                    budget === i
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.budgetLabels[i]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">
              {t.timelineLabel}{" "}
              <span className="text-emerald-300/40 normal-case tracking-normal">
                {t.optional}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TIMELINES.map((opt, i) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setTimeline(timeline === opt ? "" : opt)}
                  className={`text-sm px-3.5 py-2 rounded-full border transition ${
                    timeline === opt
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.timelineLabels[i]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-emerald-300/70 uppercase tracking-wider mb-1">
              {t.purposeLabel}{" "}
              <span className="text-emerald-300/40 normal-case tracking-normal">
                {t.optional}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSES.map((opt, i) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setPurpose(purpose === opt ? "" : opt)}
                  className={`text-sm px-3.5 py-2 rounded-full border transition ${
                    purpose === opt
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950 font-semibold"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.purposeLabels[i]}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 — name / phone / message tucked behind a disclosure.
              Most users don't need to fill these. */}
          {!moreOpen ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="text-xs text-emerald-300/70 hover:text-emerald-200 underline underline-offset-4"
            >
              {t.addMore}
            </button>
          ) : (
            <div className="space-y-3 border-t border-emerald-500/20 pt-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                    {t.nameLabel}
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                    {t.phoneLabel}
                  </span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={50}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="Optional"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-emerald-300/70 uppercase tracking-wider">
                  {t.messageLabel}
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Optional"
                />
              </label>
            </div>
          )}

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
              disabled={submitting || email.length === 0}
              className="px-5 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition disabled:opacity-50"
            >
              {submitting ? t.sending : t.submit}
            </button>
            <span className="text-xs text-emerald-300/50">{t.followUp}</span>
          </div>
          <p className="text-xs text-emerald-300/50 leading-relaxed">
            {t.consentA}
            <Link
              href={`/${resolved}/privacy`}
              className="underline hover:text-emerald-300"
            >
              {t.consentLink}
            </Link>
            {t.consentB}
          </p>
        </form>
      )}
    </section>
  );
}
