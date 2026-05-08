"use client";

import { useState } from "react";

type InquiryType = "general" | "promote" | "b2b_reports" | "press" | "other";

export type ContactStrings = {
  inquiryType: string;
  types: Record<InquiryType, string>;
  name: string;
  email: string;
  message: string;
  submit: string;
  submitting: string;
  success: string;
  errorGeneric: string;
  fallbackPrefix: string;
  fallbackEmail: string;
};

export function ContactForm({
  initialType = "general",
  condoId,
  strings,
}: {
  initialType?: InquiryType;
  condoId?: string;
  strings: ContactStrings;
}) {
  const [type, setType] = useState<InquiryType>(initialType);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiry_type: type,
          name,
          email,
          message,
          condo_id: condoId ?? null,
          referrer: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "request failed");
      }
      setState("ok");
      setName("");
      setEmail("");
      setMessage("");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "unknown error");
    }
  }

  if (state === "ok") {
    return (
      <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-emerald-200 text-sm">
        {strings.success}
      </div>
    );
  }

  const types: InquiryType[] = ["general", "promote", "b2b_reports", "press", "other"];

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">{strings.inquiryType}</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as InquiryType)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {strings.types[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{strings.name}</label>
          <input
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{strings.email}</label>
          <input
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1">{strings.message}</label>
        <textarea
          required
          minLength={5}
          maxLength={5000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 resize-y"
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="submit"
          disabled={state === "sending"}
          className="bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {state === "sending" ? strings.submitting : strings.submit}
        </button>
        <span className="text-xs text-zinc-500">
          {strings.fallbackPrefix}{" "}
          <a
            href={`mailto:${strings.fallbackEmail}`}
            className="text-zinc-300 hover:text-white underline underline-offset-2"
          >
            {strings.fallbackEmail}
          </a>
        </span>
      </div>

      {state === "error" && (
        <div className="text-red-400 text-xs">{error ?? strings.errorGeneric}</div>
      )}
    </form>
  );
}
