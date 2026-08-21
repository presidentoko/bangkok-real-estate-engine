"use client";

import "./globals.css";
import { useEffect } from "react";

// Both root layouts sit inside route groups ((site)/[lang] and (other)), so
// a throw from a root layout itself — `await params`, isLang(), getDictionary(),
// jsonLdString() — has no boundary above it and fell through to Next's own
// unstyled white page, a jarring break on a dark site. global-error REPLACES
// the root layout, so it owns <html>/<body> and can assume nothing the
// layouts render; the background is also set inline because the layout that
// normally paints it never ran.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console so issues land in Vercel logs without breaking the UI.
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        className="bg-zinc-950 text-zinc-100 min-h-screen antialiased"
        style={{ backgroundColor: "#0a0a0a", color: "#f4f4f5" }}
      >
        <main className="max-w-xl mx-auto p-6 mt-16 text-center space-y-5">
          <p className="text-6xl">⚠️</p>
          <h1 className="text-2xl font-bold">Something broke on our side</h1>
          <p className="text-zinc-400 text-sm">
            The page failed to load at all. The team has been notified; this is
            rare.
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
      </body>
    </html>
  );
}
