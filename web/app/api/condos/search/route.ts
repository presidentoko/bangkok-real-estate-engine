import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
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
  return NextResponse.json({ results: data ?? [] });
}
