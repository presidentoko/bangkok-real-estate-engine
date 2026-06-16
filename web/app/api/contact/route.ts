import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const VALID_TYPES = new Set(["property", "advertising"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function notifyTelegram(fields: {
  type: string;
  email: string;
  phone?: string | null;
  line_id?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  timeline?: string | null;
  purpose?: string | null;
  message?: string | null;
  referrer?: string | null;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const budget =
    fields.budget_min || fields.budget_max
      ? `${fields.budget_min ? "฿" + Number(fields.budget_min).toLocaleString() : "?"}–${
          fields.budget_max ? "฿" + Number(fields.budget_max).toLocaleString() : "?"
        }`
      : null;

  const typeLabel = fields.type === "property" ? "🏡 Concierge" : "📋 Operations";

  const lines = [
    `${typeLabel} INQUIRY`,
    `Email: ${fields.email}`,
    fields.phone ? `Phone: ${fields.phone}` : null,
    fields.line_id ? `LINE: ${fields.line_id}` : null,
    budget ? `Budget: ${budget}` : null,
    fields.timeline ? `Timeline: ${fields.timeline}` : null,
    fields.purpose ? `Purpose: ${fields.purpose}` : null,
    fields.message ? `Msg: ${fields.message.slice(0, 400)}` : null,
    fields.referrer ? `From: ${fields.referrer}` : null,
  ].filter(Boolean) as string[];

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: lines.join("\n") }),
    });
  } catch {
    // best-effort
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const inquiry_type = String(body.inquiry_type ?? "property");
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = body.phone ? String(body.phone).trim().slice(0, 50) : null;
  const line_id = body.line_id ? String(body.line_id).trim().slice(0, 100) : null;
  const message = body.message ? String(body.message).trim().slice(0, 5000) : null;
  const referrer = body.referrer ? String(body.referrer).slice(0, 500) : null;

  const budget_min =
    body.budget_min != null && Number.isFinite(Number(body.budget_min))
      ? Number(body.budget_min)
      : null;
  const budget_max =
    body.budget_max != null && Number.isFinite(Number(body.budget_max))
      ? Number(body.budget_max)
      : null;

  const timeline = typeof body.timeline === "string" ? body.timeline.slice(0, 20) : null;
  const purpose = typeof body.purpose === "string" ? body.purpose.slice(0, 30) : null;

  if (!VALID_TYPES.has(inquiry_type)) {
    return NextResponse.json({ error: "invalid inquiry_type" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (inquiry_type === "advertising" && (!message || message.length < 5)) {
    return NextResponse.json(
      { error: "message required for advertising inquiries" },
      { status: 400 },
    );
  }

  const supabase = getServerSupabase();

  // LINE ID stored in message field (no dedicated column needed)
  const fullMessage = [line_id ? `LINE: ${line_id}` : null, message]
    .filter(Boolean)
    .join("\n") || null;

  const { error } = await supabase.from("leads").insert({
    inquiry_type,
    email,
    phone,
    budget_min,
    budget_max,
    timeline,
    purpose,
    message: fullMessage,
    referrer,
  });

  if (error) {
    console.error("[contact] insert failed:", error.message);
    return NextResponse.json({ error: "could not save inquiry" }, { status: 500 });
  }

  void notifyTelegram({
    type: inquiry_type,
    email,
    phone,
    line_id,
    budget_min,
    budget_max,
    timeline,
    purpose,
    message,
    referrer,
  });

  return NextResponse.json({ ok: true });
}
