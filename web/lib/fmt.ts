/**
 * Centralized formatters — single source of truth for THB amounts, %, etc.
 *
 * Previously 6 components each had their own `formatTHB` / `fmtTHB` variant
 * with subtle differences (some used K for thousands, others didn't). This
 * killed consistency: the same sale price could render ฿580K in one place
 * and ฿580,000 in another.
 *
 * The consolidation didn't hold the first time — ReportCard kept a private
 * copy with a K branch. The compact form now lives here as `fmtTHBCompact`,
 * so space-constrained cards have something to import instead of re-writing.
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
 * Compact THB for space-constrained surfaces (report card, alert rows):
 *   ≥ 1,000,000 → ฿1.23M
 *   ≥ 1,000     → ฿580K
 *   else        → ฿640
 *
 * Null / undefined → "—".
 */
export function fmtTHBCompact(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${Math.round(n).toLocaleString()}`;
}

/**
 * Amount that carries an explicit currency column from the database.
 *
 * Every price we store is baht, but the column is nullable and the callers
 * used to fall back to "USD" — which rendered a ฿5,200,000 listing as
 * "USD 5,200,000", a ~35x overstatement. Null/THB goes through fmtTHB; a
 * genuine foreign code is printed verbatim rather than silently mislabelled.
 */
export function fmtMoney(
  v: number | string | null | undefined,
  currency: string | null | undefined
): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  if (currency && currency.toUpperCase() !== "THB") {
    return `${currency} ${Math.round(n).toLocaleString("en-US")}`;
  }
  return fmtTHB(n);
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
