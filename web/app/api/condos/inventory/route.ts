import { NextResponse } from "next/server";
import { canonicalCitySlug } from "@/lib/cities";
import { fetchCondoSummariesByCity } from "@/lib/queries/condos";

// City-scoped condo list for the inventory grid. The page used to ship the
// entire city-scoped array to the browser as an RSC prop (thousands of objects
// for Bangkok) even though the grid renders nothing until the user filters or
// hits "Show all". This route lets the client lazy-fetch that set on demand so
// the initial page payload stays tiny.
//
// The fetch is scoped to the city at the DB level (lean column projection, no
// `url`), so smaller cities cache via unstable_cache; Bangkok exceeds the 2MB
// unstable_cache ceiling, so this CDN `s-maxage` header is what keeps repeat
// requests fast (served from the edge for an hour, stale-while-revalidate a day).
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cityParam = (url.searchParams.get("city") ?? "bangkok").trim() || "bangkok";
  const target = canonicalCitySlug(cityParam);

  const condos = await fetchCondoSummariesByCity(target);

  return NextResponse.json({ condos }, { headers: CACHE_HEADERS });
}
