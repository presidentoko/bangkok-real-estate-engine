"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so issues land in Vercel logs without breaking the UI.
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <main className="max-w-xl mx-auto p-6 mt-16 text-center space-y-5">
      <p className="text-6xl">⚠️</p>
      <h1 className="text-2xl font-bold">Something broke on our side</h1>
      <p className="text-zinc-400 text-sm">
        A query or render failed. The team has been notified; this is rare.
      </p>
      {error.digest && (
        <p className="text-xs text-zinc-600 font-mono">
          reference: {error.digest}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm pt-2">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-full bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
        >
          Try again
        </button>
        <a
          href="/en"
          className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 transition"
        >
          Home
        </a>
      </div>
    </main>
  );
}
