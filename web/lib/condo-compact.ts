// Columnar ("struct-of-arrays") encoding of a city's condo summaries for the
// inventory feed.
//
// Why this exists
// ---------------
// A big city (Bangkok ≈ 6.3k rows) serialised as an array of objects spends
// ~1.1MB on nothing but JSON key names repeated on every row
// ("hero_image_url", "market_summary_currency", "market_sale_median", …). That
// pushed the payload past Next's 2MB `unstable_cache` ceiling, so the city feed
// was never memoised — every cold request re-ran a ~4.5s Supabase fetch, which
// is what left the inventory grid stuck on its loading skeletons.
//
// Storing each field as one array (so every key is written exactly once) drops
// the payload well under 2MB → it caches, the cold fetch disappears, and the
// wire transfer shrinks too. `province` / `url` / `available_units_count` are
// omitted because neither the grid, the cards, nor the page's dashboard stats
// read them; lat/lng ARE kept because the page's "geo-located" stat needs them.

import type { CondoSummary, PropertyType } from "./queries/condos";

export type CompactCondoSummaries = {
  v: 1;
  count: number;
  id: string[];
  name: string[];
  region: (string | null)[];
  // Optional: server-only callers (stats page) get these; the API route strips
  // them before responding to the browser to save ~100KB on Bangkok's payload.
  lat?: (number | null)[];
  lng?: (number | null)[];
  hero: (string | null)[];
  bubble: (number | null)[];
  superValue: (boolean | null)[];
  flood: (number | null)[];
  units: (number | null)[];
  sale: (number | null)[];
  rent: (number | null)[];
  currency: (string | null)[];
  type: PropertyType[];
  source: string[];
};

export function encodeCompact(rows: CondoSummary[]): CompactCondoSummaries {
  const n = rows.length;
  const c: CompactCondoSummaries = {
    v: 1,
    count: n,
    id: new Array(n),
    name: new Array(n),
    region: new Array(n),
    lat: new Array(n),
    lng: new Array(n),
    hero: new Array(n),
    bubble: new Array(n),
    superValue: new Array(n),
    flood: new Array(n),
    units: new Array(n),
    sale: new Array(n),
    rent: new Array(n),
    currency: new Array(n),
    type: new Array(n),
    source: new Array(n),
  };
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    c.id[i] = r.id;
    c.name[i] = r.name;
    c.region[i] = r.region;
    if (c.lat) c.lat[i] = r.latitude;
    if (c.lng) c.lng[i] = r.longitude;
    c.hero[i] = r.hero_image_url;
    c.bubble[i] = r.bubble_index;
    c.superValue[i] = r.is_super_value;
    c.flood[i] = r.flood_risk_level;
    c.units[i] = r.total_units;
    c.sale[i] = r.market_sale_median;
    c.rent[i] = r.market_rent_median;
    c.currency[i] = r.market_summary_currency;
    c.type[i] = r.property_type;
    c.source[i] = r.source;
  }
  return c;
}

export function decodeCompact(c: CompactCondoSummaries): CondoSummary[] {
  const out: CondoSummary[] = new Array(c.count);
  for (let i = 0; i < c.count; i++) {
    out[i] = {
      id: c.id[i],
      slug: null,
      name: c.name[i],
      url: null,
      latitude: c.lat?.[i] ?? null,
      longitude: c.lng?.[i] ?? null,
      region: c.region[i],
      province: "",
      hero_image_url: c.hero[i],
      bubble_index: c.bubble[i],
      is_super_value: c.superValue[i],
      flood_risk_level: c.flood[i],
      total_units: c.units[i],
      available_units_count: null,
      market_sale_median: c.sale[i],
      market_rent_median: c.rent[i],
      market_summary_currency: c.currency[i],
      property_type: c.type[i],
      source: c.source[i],
    };
  }
  return out;
}

// Type guard so callers can accept either the legacy `{ condos: [...] }` shape
// (a stale CDN entry served right after deploy) or the new compact payload.
export function isCompact(x: unknown): x is CompactCondoSummaries {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { v?: unknown }).v === 1 &&
    Array.isArray((x as { id?: unknown }).id)
  );
}
