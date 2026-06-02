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
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cityParam = (url.searchParams.get("city") ?? "bangkok").trim() || "bangkok";
  const target = canonicalCitySlug(cityParam);

  const compact = await fetchCondoSummariesCompactByCity(target);

  return NextResponse.json(compact, { headers: CACHE_HEADERS });
}
