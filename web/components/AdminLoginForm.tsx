"use client";

import { useState } from "react";

type Props = {
  next?: string;
  initialError?: string;
};

export function LoginForm({ next, initialError }: Props) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(initialError ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "Sign-in failed");
        setBusy(false);
        return;
      }
      const dest = next && next.startsWith("/admin") ? next : "/admin/leads";
      window.location.href = dest;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <label className="block">
        <span className="text-xs text-zinc-400 uppercase tracking-wider">
          Admin secret
        </span>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
          autoFocus
          className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500"
        />
      </label>

      {err && <p className="text-sm text-rose-400">{err}</p>}

      <button
        type="submit"
        disabled={busy || secret.length === 0}
        className="w-full px-5 py-3 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-emerald-400 transition"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-zinc-500 text-xs">
        Session cookie valid for 30 days. Generated from the
        <code className="text-zinc-300"> ADMIN_SECRET </code>env var.
      </p>
    </form>
  );
}
