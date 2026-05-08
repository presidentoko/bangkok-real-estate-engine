import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

type Body = {
  chat_id?: string;
  districts?: string[];
  bubble_threshold?: number;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const chat_id = (body.chat_id ?? "").trim();
  if (!/^-?\d{4,}$/.test(chat_id)) {
    return NextResponse.json(
      { error: "chat_id must be numeric (Telegram chat ID)" },
      { status: 400 }
    );
  }

  const districts = Array.isArray(body.districts)
    ? body.districts.filter((d) => typeof d === "string" && d.length > 0)
    : [];

  const threshold = Number(body.bubble_threshold);
  if (!Number.isFinite(threshold) || threshold < 50 || threshold > 100) {
    return NextResponse.json(
      { error: "bubble_threshold must be 50–100" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("alert_subscribers")
    .upsert(
      {
        channel: "telegram",
        channel_id: chat_id,
        districts: districts.length ? districts : null,
        bubble_threshold: threshold,
        is_active: true,
      },
      { onConflict: "channel,channel_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
