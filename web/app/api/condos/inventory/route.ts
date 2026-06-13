import { NextResponse } from "next/server";
import { canonicalCitySlug } from "@/lib/cities";
import { fetchCondoSummariesCompactByCity } from "@/lib/queries/condos";

// City-scoped condo list for the inventory grid. The page used to ship the
// entire city-scoped array to the browser as an RSC prop (thousands of objects
// for Bangkok) even though the grid renders nothing until the user filters or
// hits "Show all". This route lets the client lazy-fetch that set on demand so
// the initial page payload stays tiny.
//
// The payload is a compact columnar encoding (see lib/condo-compact.ts): the
// array-of-objects form spent ~1.1MB on repeated JSON keys, which pushed even
// the lean projection past the 2MB unstable_cache ceiling so nothing cached.
// Columnar keeps it under 2MB → the underlying fetch is memoised by
// unstable_cache, and this CDN `s-maxage` header keeps the edge warm on top
// (served for an hour, stale-while-revalidate a day). The client decodes it
// with decodeCompact().
// Browser: 1h (same user refreshing within the hour gets 0 bytes from CDN).
// CDN (s-maxage): 24h — scrapers run weekly so data is safe stale for a day.
// stale-while-revalidate: 7d — CDN serves the old copy while regenerating,
// so no request ever waits on a cold revalidation.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cityParam = (url.searchParams.get("city") ?? "bangkok").trim() || "bangkok";
  const target = canonicalCitySlug(cityParam);

  const compact = await fetchCondoSummariesCompactByCity(target);
  // Coordinates are only used server-side (geo-located stat). Stripping them
  // from the browser response saves ~100 KB on Bangkok's 6k-row payload.
  const { lat: _lat, lng: _lng, ...slim } = compact;
  return NextResponse.json(slim, { headers: CACHE_HEADERS });
}
