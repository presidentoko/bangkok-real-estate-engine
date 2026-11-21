// Helpers for app/llms.txt/route.ts. A failed count must never become a "0"
// that ISR then caches for a week (that happened on 2026-11-21: the exact
// active-listings count timed out during the Vercel build and zeros were
// cached). These throw instead, so Next keeps the last good copy.

export type CountResult = { count: number | null; error?: { code?: string; message?: string } | null };

export function requireCount(res: CountResult, label: string, min = 0): number {
  if (res.error) throw new Error(`llms.txt: ${label} count failed (${res.error.code ?? res.error.message})`);
  if (res.count == null || res.count < min) {
    throw new Error(`llms.txt: ${label} count unusable (${res.count})`);
  }
  return res.count;
}

// The planner estimate on the large listings table is only approximate, so it
// is rounded to the nearest hundred.
export function roundEstimate(n: number, step = 100): number {
  return Math.round(n / step) * step;
}
