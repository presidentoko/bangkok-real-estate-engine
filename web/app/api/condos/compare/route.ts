import { NextResponse } from "next/server";
import type { CompareData } from "@/lib/compare";
import { parseCompareIds } from "@/lib/compare";
import { fetchCompareCondos } from "@/lib/queries/compare";
import { getCurrentMortgageRate } from "@/lib/queries/yield";
import { getServerSupabase } from "@/lib/supabase";

// Up to 3 condos for the /compare client table. The page itself is a fully
// static empty-state shell; a/b/c id combos are resolved client-side by
// fetching this route, so bots/crawlers hitting the near-infinite id
// permutations never invoke a Function — only a human who actually clicked
// "Add to compare" does, and each exact combo is CDN-cached for a day.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = parseCompareIds((key) => url.searchParams.get(key));

  const supabase = getServerSupabase();
  const [{ condos, scores, risks, liv }, mortgage] = await Promise.all([
    fetchCompareCondos(supabase, ids),
    getCurrentMortgageRate(),
  ]);

  const payload: CompareData = {
    condos,
    scores: Object.fromEntries(scores),
    risks: Object.fromEntries(risks),
    liv: Object.fromEntries(liv),
    mrr: mortgage?.rate ?? null,
  };

  return NextResponse.json(payload, { headers: CACHE_HEADERS });
}
