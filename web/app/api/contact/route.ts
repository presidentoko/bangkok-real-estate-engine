import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

const VALID_TYPES = new Set(["general", "promote", "b2b_reports", "press", "other"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const inquiry_type = String(body.inquiry_type ?? "general");
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const condo_id = body.condo_id ? String(body.condo_id) : null;
  const referrer = body.referrer ? String(body.referrer).slice(0, 500) : null;

  if (!VALID_TYPES.has(inquiry_type)) {
    return NextResponse.json({ error: "invalid inquiry_type" }, { status: 400 });
  }
  if (name.length < 1 || name.length > 200) {
    return NextResponse.json({ error: "name required (1–200 chars)" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  if (message.length < 5 || message.length > 5000) {
    return NextResponse.json({ error: "message required (5–5000 chars)" }, { status: 400 });
  }

  const submitter_ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const supabase = getServerSupabase();
  const { error } = await supabase.from("leads").insert({
    inquiry_type,
    name,
    email,
    message,
    condo_id,
    referrer,
    submitter_ip,
  });

  if (error) {
    console.error("[contact] insert failed:", error.message);
    return NextResponse.json({ error: "could not save inquiry" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
