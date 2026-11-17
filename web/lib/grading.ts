// Score → letter grade conversion. Tuned to give A-F a meaningful spread on
// the active Bangkok condo set; revisit once we have real percentiles in DB.

import { BUBBLE_OVERPRICED, BUBBLE_UNDERPRICED } from "./bubble.ts";

// "?" = no data. Shown as a grey tile, never as a letter: a missing flood
// level used to grade "C", which reads as a measured middle (audit M8).
export type Grade = "A" | "B" | "C" | "D" | "F" | "?";

export const GRADE_BG: Record<Grade, string> = {
  A: "bg-emerald-500",
  B: "bg-lime-500",
  C: "bg-yellow-400",
  D: "bg-orange-500",
  F: "bg-red-500",
  "?": "bg-zinc-700",
};

export const GRADE_FG: Record<Grade, string> = {
  A: "text-emerald-50",
  B: "text-lime-950",
  C: "text-yellow-950",
  D: "text-orange-50",
  F: "text-red-50",
  "?": "text-zinc-100",
};

// Bubble Index: 100 = on the district median. Bands come from lib/bubble.ts:
// A = underpriced (<80), F = bubble suspect (>130); B/C/D split the in-line
// band. Unknown is "?", not a letter.
export function gradeFromBubble(bi: number | null | undefined): Grade {
  if (bi == null) return "?";
  if (bi < BUBBLE_UNDERPRICED) return "A";
  if (bi <= 100) return "B";
  if (bi <= 115) return "C";
  if (bi <= BUBBLE_OVERPRICED) return "D";
  return "F";
}

// Closest of BTS / MRT in metres.
export function gradeFromTransit(
  btsM: number | null,
  mrtM: number | null
): Grade {
  const candidates = [btsM, mrtM].filter((d): d is number => d != null);
  if (candidates.length === 0) return "F";
  const closest = Math.min(...candidates);
  if (closest <= 300) return "A";
  if (closest <= 500) return "B";
  if (closest <= 800) return "C";
  if (closest <= 1200) return "D";
  return "F";
}

// Hospitals / schools / supermarkets within 1 km.
export function gradeFromInfra(h: number, s: number, m: number): Grade {
  const score = Math.min(20, h * 4) + Math.min(20, s * 3) + Math.min(20, m * 4);
  if (score >= 50) return "A";
  if (score >= 38) return "B";
  if (score >= 25) return "C";
  if (score >= 12) return "D";
  return "F";
}

// Flood risk: 0..5 from district baseline. Lower = better.
export function gradeFromFlood(level: number | null | undefined): Grade {
  if (level == null) return "?"; // unknown: not measured, never "safe"
  if (level <= 1) return "A";
  if (level === 2) return "B";
  if (level === 3) return "C";
  if (level === 4) return "D";
  return "F";
}
