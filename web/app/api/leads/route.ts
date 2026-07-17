import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIMELINES = ["now", "3mo", "6mo", "12mo", "browsing"] as const;
const PURPOSES = ["own", "rent_invest", "flip", "undecided"] as const;

type Body = {
  condo_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  budget_min?: number | string;
  budget_max?: number | string;
  timeline?: string;
  purpose?: string;
  nationality?: string;
  message?: string;
  source_url?: string;
  // Honeypot — real users leave empty; bots fill anything.
  website?: string;
};

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha1").update(ip).digest("hex");
}

function clientIp(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    null
  );
}

async function notifyOps(lead: {
  email: string;
  name?: string | null;
  condo_id?: string | null;
  message?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  timeline?: string | null;
  source_url?: string | null;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const budget =
    lead.budget_min || lead.budget_max
      ? `${lead.budget_min ? "฿" + Number(lead.budget_min).toLocaleString() : "?"}–${
          lead.budget_max ? "฿" + Number(lead.budget_max).toLocaleString() : "?"
        }`
      : null;
  const lines = [
    "🎯 NEW LEAD",
    lead.name ? `Name: ${lead.name}` : null,
    `Email: ${lead.email}`,
    lead.condo_id ? `Condo: ${lead.condo_id}` : null,
    lead.timeline ? `Timeline: ${lead.timeline}` : null,
    budget ? `Budget: ${budget}` : null,
    lead.message ? `Msg: ${lead.message.slice(0, 300)}` : null,
    lead.source_url ? `From: ${lead.source_url}` : null,
  ].filter(Boolean) as string[];
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n") }),
    });
  } catch {
    // best effort — don't fail the lead capture if Telegram is down
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Honeypot
  if (body.website && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, suppressed: true });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "valid email is required" }, { status: 400 });
  }

  const name = body.name?.trim().slice(0, 200) || null;
  const phone = body.phone?.trim().slice(0, 50) || null;
  const message = body.message?.trim().slice(0, 2000) || null;
  const source_url = body.source_url?.trim().slice(0, 500) || null;
  const nationality = body.nationality?.trim().slice(0, 80) || null;

  const timeline = TIMELINES.includes(body.timeline as (typeof TIMELINES)[number])
    ? body.timeline
    : null;
  const purpose = PURPOSES.includes(body.purpose as (typeof PURPOSES)[number])
    ? body.purpose
    : null;

  const budget_min =
    body.budget_min != null && Number.isFinite(Number(body.budget_min))
      ? Number(body.budget_min)
      : null;
  const budget_max =
    body.budget_max != null && Number.isFinite(Number(body.budget_max))
      ? Number(body.budget_max)
      : null;

  // condo_id must look like a UUID if present
  const condo_id =
    typeof body.condo_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.condo_id)
      ? body.condo_id
      : null;

  const ip = clientIp(req);
  const ip_hash = hashIp(ip);
  const user_agent = req.headers.get("user-agent")?.slice(0, 400) || null;
  const referrer = req.headers.get("referer")?.slice(0, 500) || null;

  const supabase = getServerSupabase();

  // Rate limit — same IP can submit at most 5 leads / hour.
  if (ip_hash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ip_hash)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: "Too many submissions. Try again later." },
        { status: 429 },
      );
    }
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      condo_id,
      name,
      email,
      phone,
      budget_min,
      budget_max,
      timeline,
      purpose,
      nationality,
      message,
      source_url,
      referrer,
      user_agent,
      ip_hash,
      // Pre-existing leads schemas use 'general' as the safe inquiry_type
      // value (confirmed via constraint probe). Use it for both condo and
      // general consults — migration 012 also drops the CHECK so any
      // future value works.
      inquiry_type: "general",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[leads] insert failed:", error.message);
    return NextResponse.json({ error: "could not save lead" }, { status: 500 });
  }

  await notifyOps({
    email,
    name,
    condo_id,
    message,
    budget_min,
    budget_max,
    timeline,
    source_url,
  });

  return NextResponse.json({ ok: true, id: data?.id });
}
