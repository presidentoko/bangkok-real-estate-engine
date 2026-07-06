import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase";

const ALLOWED_PLATFORMS = ["youtube", "blog", "instagram", "tiktok", "news", "other"];

type Body = {
  condo_id?: string;
  promoted_by?: string;
  promotion_url?: string;
  platform?: string;
  claim?: string;
  promoted_at?: string; // YYYY-MM-DD
};

export async function POST(req: Request) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const condo_id = (body.condo_id ?? "").trim();
  const promoted_by = (body.promoted_by ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(condo_id)
  ) {
    return NextResponse.json(
      { error: "condo_id must be a UUID" },
      { status: 400 }
    );
  }
  if (!promoted_by) {
    return NextResponse.json(
      { error: "promoted_by is required" },
      { status: 400 }
    );
  }
  const platform = (body.platform ?? "other").trim();
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of ${ALLOWED_PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("condo_promotions")
    .insert({
      condo_id,
      promoted_by,
      promotion_url: body.promotion_url?.trim() || null,
      platform,
      claim: body.claim?.trim() || null,
      promoted_at: body.promoted_at?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function GET() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("v_promoted_condos")
    .select("*")
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ promotions: data ?? [] });
}
