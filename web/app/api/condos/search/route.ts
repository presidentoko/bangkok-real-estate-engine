import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

// Cache identical `?q=` queries on the edge for 1 day, serving stale for up
// to a week while revalidating. Underlying condo names only change on the
// weekly scrape + Wednesday catch-pass, so the original 5-minute window
// bought almost no reuse — nearly every debounced keystroke-final query
// still invoked the function. Matches the same s-maxage pattern already
// used by the compare/inventory/yields routes.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
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
    .select("id, slug, name, regions(name), developer")
    .ilike("name", `%${q}%`)
    .limit(10);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ results: data ?? [] }, { headers: CACHE_HEADERS });
}
