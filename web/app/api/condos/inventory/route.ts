import { NextResponse } from "next/server";
import { canonicalCitySlug } from "@/lib/cities";
import { fetchAllCondos } from "@/lib/queries/condos";

// City-scoped condo list for the inventory grid. The page used to ship the
// entire city-scoped array to the browser as an RSC prop (thousands of objects
// for Bangkok) even though the grid renders nothing until the user filters or
// hits "Show all". This route lets the client lazy-fetch that set on demand so
// the initial page payload stays tiny.
//
// Backed by the same `fetchAllCondos` unstable_cache the page uses, so this is
// a cheap in-memory filter once the cache is warm.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cityParam = (url.searchParams.get("city") ?? "bangkok").trim() || "bangkok";
  const target = canonicalCitySlug(cityParam);

  const all = await fetchAllCondos();
  const condos = all.filter((c) => canonicalCitySlug(c.province) === target);

  return NextResponse.json({ condos }, { headers: CACHE_HEADERS });
}
