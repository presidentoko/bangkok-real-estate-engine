import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { clientIp, hashIp, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Each request triggers a Telegram sendMessage plus a DB upsert — cap it so
// a flood of requests can't spam arbitrary Telegram chats or hammer the
// bot token (which would start getting rate-limited by Telegram itself,
// breaking real alerts for everyone) or bloat alert_subscribers.
const RATE_LIMIT_MAX = 5; // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type Body = {
  chat_id?: string;
  districts?: string[];
  bubble_threshold?: number;
};

// The #1 silent-failure mode for Telegram alerts: the user typos their chat
// ID (or copies the wrong number, or never messaged the bot to open the DM
// channel), the form happily says "Subscribed", and they never find out —
// because the only place that would notice is a fire-and-forget send() deep
// in the alert pipeline, days later. We catch it here instead by sending a
// real confirmation message at signup time and surfacing any failure right
// in the form. Falls back to "trust it" if the bot token isn't configured.
async function verifyTelegramChat(
  chatId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: true };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          "✅ Subscribed — you'll get a message here the next time a Bangkok " +
          "condo listing in your filter drops under your Bubble Index threshold.",
      }),
    });
    if (res.ok) return { ok: true };
    const j: { description?: string } = await res.json().catch(() => ({}));
    const desc = j.description ?? "";
    if (/chat not found/i.test(desc) || /bot was blocked/i.test(desc)) {
      return {
        ok: false,
        error:
          "That chat ID isn't reachable yet — open Telegram, message @Bkkbudong_bot, " +
          "tap /start, then try subscribing again.",
      };
    }
    return { ok: false, error: `Telegram rejected that chat ID (${desc || "unknown error"}).` };
  } catch {
    // Network hiccup talking to Telegram shouldn't block signup on our end.
    return { ok: true };
  }
}

export async function POST(req: Request) {
  const ipHash = hashIp(clientIp(req));
  if (ipHash && isRateLimited(`alerts-subscribe:${ipHash}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

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

  const verify = await verifyTelegramChat(chat_id);
  if (!verify.ok) {
    return NextResponse.json({ error: verify.error }, { status: 400 });
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
