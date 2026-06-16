import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json({
      ok: false,
      error: "env vars missing",
      has_token: !!token,
      has_chat_id: !!chatId,
    });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Test from Bangkok Real Estate Engine — Telegram bot is working.",
      }),
    });
    const json = await res.json();
    return NextResponse.json({ status: res.status, telegram_response: json });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
