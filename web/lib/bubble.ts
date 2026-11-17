/**
 * The one definition of the Bubble Index bands (data audit 2026-11-17, M11).
 *
 * Before this the site said three things: the Korean home FAQ "below 100 =
 * underpriced", About / the English FAQ "<80 underpriced, >130 bubble", the
 * report card graded A at <=85, and the inventory filter used <90. Every
 * surface now reads these constants; the copy states the same numbers.
 * src/analysis/underpriced.py (alerts at <= 80) matches BUBBLE_UNDERPRICED.
 */
export const BUBBLE_UNDERPRICED = 80; // below this: underpriced
export const BUBBLE_OVERPRICED = 130; // above this: bubble suspect

export type BubbleBand = "under" | "market" | "over";

export function bubbleBand(bi: number | null | undefined): BubbleBand | null {
  if (bi == null || !Number.isFinite(bi)) return null;
  if (bi < BUBBLE_UNDERPRICED) return "under";
  if (bi > BUBBLE_OVERPRICED) return "over";
  return "market";
}
