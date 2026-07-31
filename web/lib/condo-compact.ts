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

// hero_image_url values from img.hipcdn.com are a base64-encoded JSON blob
// like {"bucket":"prd-lifullconnect-projects-admin-images","key":"<uuid>/
// <uuid>_<file>.jpg","brand":"hipflat","edits":{"rotate":null,"resize":
// {"width":936,"height":505,"fit":"cover"}}} — everything except `key` is
// identical across every row (confirmed 2026-07-31 against a 1000-row
// sample: single bucket, single brand, single edits config). At ~371 chars
// average and hero_image_url present on ~15% of condos, this redundancy was
// the single biggest contributor to condos:by-city-compact(bangkok) sitting
// at 1.99MB, 0.01MB under Next's 2MB unstable_cache ceiling. Storing just
// `key` (avg ~130 chars) and rebuilding the full URL on decode recovers
// most of that without dropping the field or changing what renders.
const HIPCDN_PREFIX = "https://img.hipcdn.com/";
const HIPCDN_BUCKET = "prd-lifullconnect-projects-admin-images";
const HIPCDN_BRAND = "hipflat";
const HIPCDN_EDITS = { rotate: null, resize: { width: 936, height: 505, fit: "cover" } };
const KEY_MARKER = "k:"; // compact form is stored as this marker + the raw `key`

// btoa/atob (not Buffer) so this runs identically on the server AND in the
// browser — decodeCompact() is called from both (the inventory page's
// client-side city-switch path decodes in-browser). Every value that passes
// through here is plain ASCII (UUIDs, filenames, JSON punctuation), so the
// Latin1-only semantics of atob/btoa are safe — no UTF-8 multibyte content.
function base64UrlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

export function shrinkHeroUrl(url: string | null): string | null {
  if (!url || !url.startsWith(HIPCDN_PREFIX)) return url;
  const seg = url.slice(HIPCDN_PREFIX.length).split("?")[0];
  try {
    const decoded = JSON.parse(base64UrlDecode(seg)) as {
      bucket?: string; key?: string; brand?: string; edits?: unknown;
    };
    if (
      decoded.bucket !== HIPCDN_BUCKET ||
      decoded.brand !== HIPCDN_BRAND ||
      JSON.stringify(decoded.edits) !== JSON.stringify(HIPCDN_EDITS) ||
      !decoded.key
    ) {
      return url; // doesn't match the known shape — keep the full URL, don't guess
    }
    return KEY_MARKER + decoded.key;
  } catch {
    return url; // malformed/unexpected encoding — keep the full URL
  }
}

export function expandHeroUrl(stored: string | null): string | null {
  if (!stored || !stored.startsWith(KEY_MARKER)) return stored;
  const key = stored.slice(KEY_MARKER.length);
  const json = JSON.stringify({ bucket: HIPCDN_BUCKET, key, brand: HIPCDN_BRAND, edits: HIPCDN_EDITS });
  return HIPCDN_PREFIX + base64UrlEncode(json);
}

export type CompactCondoSummaries = {
  v: 1;
  count: number;
  id: string[];
  slug: (string | null)[];
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
    slug: new Array(n),
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
    c.slug[i] = r.slug;
    c.name[i] = r.name;
    c.region[i] = r.region;
    if (c.lat) c.lat[i] = r.latitude;
    if (c.lng) c.lng[i] = r.longitude;
    c.hero[i] = shrinkHeroUrl(r.hero_image_url);
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
      slug: c.slug[i],
      name: c.name[i],
      url: null,
      latitude: c.lat?.[i] ?? null,
      longitude: c.lng?.[i] ?? null,
      region: c.region[i],
      province: "",
      hero_image_url: expandHeroUrl(c.hero[i]),
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

// Next's unstable_cache silently drops (never throws) any payload over 2MB
// -- that's exactly the bug class this file exists to fix, and it already
// bit two different queries (fetchCondoMapPoints, city/[slug]'s condo feed)
// as the catalog grew past the row count that used to fit as plain objects.
// Columnar encoding buys headroom, not immunity: the same growth will
// eventually push a compact payload over 2MB too. Call this right after
// encoding so that failure mode becomes a loud log instead of a silent
// never-cached query, with enough runway (warns at 1.8MB, ~10% margin) to
// fix it before it actually breaches.
const CACHE_WARN_BYTES = 1_800_000;

export function warnIfNearCacheCeiling(label: string, payload: unknown): void {
  const size = JSON.stringify(payload).length;
  if (size > CACHE_WARN_BYTES) {
    console.warn(
      `[cache-ceiling] ${label} is ${(size / 1_000_000).toFixed(2)}MB, ` +
      `approaching Next's 2MB unstable_cache limit — will silently stop caching soon.`
    );
  }
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
