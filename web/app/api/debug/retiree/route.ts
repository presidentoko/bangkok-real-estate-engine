import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("condos_published")
    .select(
      "id, slug, name, province, retiree_score, gross_yield_pct, avg_sale_price, " +
        "foreign_quota_inventory_pct, cam_fee_per_month, regions(name), " +
        "livability_metrics(hospitals_within_1km)"
    )
    .gte("retiree_score", 55)
    .in("province", ["chiangmai", "chiang-mai"])
    .order("retiree_score", { ascending: false })
    .limit(60);

  return NextResponse.json({
    count: data?.length ?? 0,
    error: error ?? null,
    rows: data?.slice(0, 3) ?? [],
    env: {
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  });
}
