// web/lib/stations.ts
// Pure station-name normalization. Station data labels are noisy and the
// BTS/MRT columns are not reliable line indicators, so we treat all station
// names as one namespace keyed by a URL slug.

export function stationSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** slug -> first-seen canonical display name. */
export type StationIndex = Map<string, string>;

export function buildStationIndex(names: string[]): StationIndex {
  const idx: StationIndex = new Map();
  for (const raw of names) {
    if (!raw) continue;
    const slug = stationSlug(raw);
    if (!slug) continue;
    // Prefer the first non-empty, trimmed canonical spelling.
    if (!idx.has(slug)) idx.set(slug, raw.trim());
  }
  return idx;
}

export function slugToDisplayName(idx: StationIndex, slug: string): string | null {
  return idx.get(slug) ?? null;
}
