import { NextResponse } from "next/server";
import { fetchYieldRows } from "@/lib/queries/yield";
import { getServerSupabase } from "@/lib/supabase";

// Filtered/sorted yield rows for the /yields client explorer. The page itself
// is fully static (default view); non-default ?province/?sort/?min_yield
// combinations are applied client-side by fetching this route. Only ~30
// permutations exist and each is CDN-cached for a day, so the invocation cost
// is bounded — and bots hitting the HTML permutations never invoke anything.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = getServerSupabase();
  const rows = await fetchYieldRows(supabase, {
    province: url.searchParams.get("province"),
    sort: url.searchParams.get("sort"),
    minYield: url.searchParams.get("min_yield"),
  });
  return NextResponse.json({ rows }, { headers: CACHE_HEADERS });
}
