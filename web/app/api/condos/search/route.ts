import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

// Cache identical queries on the edge for 5 minutes and serve stale for
// another 10 minutes while revalidating. Same `?q=` value within the window
// reuses the cached response instead of invoking the function.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: CACHE_HEADERS });
  }
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("condos_published")
    .select("id, name, regions(name), developer")
    .ilike("name", `%${q}%`)
    .limit(10);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ results: data ?? [] }, { headers: CACHE_HEADERS });
}
