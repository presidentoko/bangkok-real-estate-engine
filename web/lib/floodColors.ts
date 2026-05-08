// Flood risk level (0..5) → color + descriptor.
// Mirrors src/data/flood_districts.py severity scale.

export type FloodLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const FLOOD_COLORS: Record<FloodLevel, string> = {
  0: "#1f2937", // none — slate
  1: "#10b981", // very low — emerald
  2: "#84cc16", // low — lime
  3: "#facc15", // moderate — yellow
  4: "#fb923c", // high — orange
  5: "#dc2626", // severe — red
};

export const FLOOD_DESCRIPTORS: Record<FloodLevel, string> = {
  0: "안전 (관측 사례 없음)",
  1: "매우 낮음 — 중심 고지대",
  2: "낮음 — 가끔 빗물 고임",
  3: "보통 — 동네 단위 침수 빈번",
  4: "높음 — 2011년 침수, 매년 허리까지",
  5: "심각 — 우기마다 광범위 침수",
};

export function colorForLevel(level: number | null | undefined): string {
  if (level == null) return "#3f3f46"; // unknown — zinc
  const clamped = Math.max(0, Math.min(5, Math.round(level))) as FloodLevel;
  return FLOOD_COLORS[clamped];
}

export function descriptorForLevel(level: number | null | undefined): string {
  if (level == null) return "데이터 없음";
  const clamped = Math.max(0, Math.min(5, Math.round(level))) as FloodLevel;
  return FLOOD_DESCRIPTORS[clamped];
}
