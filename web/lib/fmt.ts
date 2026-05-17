/**
 * Centralized formatters — single source of truth for THB amounts, %, etc.
 *
 * Previously 6 components each had their own `formatTHB` / `fmtTHB` variant
 * with subtle differences (some used K for thousands, others didn't). This
 * killed consistency: the same sale price could render ฿580K in one place
 * and ฿580,000 in another.
 */

/**
 * Format a THB amount. Defaults to:
 *   ≥ 1,000,000 → ฿1.23M
 *   else        → ฿123,456 (comma-grouped, no decimals)
 *
 * Null / undefined → "—".
 */
export function fmtTHB(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  return `฿${Math.round(n).toLocaleString()}`;
}

/**
 * Signed percentage point delta (e.g. +1.25pp, -0.8pp). Null → "—".
 */
export function fmtPP(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp`;
}

/**
 * Percentage with 1-2 decimals depending on magnitude. Null → "—".
 */
export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}%`;
}
