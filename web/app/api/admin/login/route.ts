import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_MAX_AGE_S, createAdminSession } from "@/lib/adminSession";
import { clientIp, hashIp, isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

const COOKIE_NAME = "admin_session";

// Basic per-IP throttle on ADMIN_SECRET attempts — this endpoint gates
// access to lead PII, so unlimited online brute-force isn't acceptable.
// In-memory is fine: this is a single low-traffic Vercel Hobby deployment,
// same trade-off as the /api/ask rate limiter.
const LOGIN_ATTEMPT_MAX = 5; // attempts per window
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Validate a constant-time secret comparison without leaking timing info.
 * Both inputs are SHA256-hashed first so length differences don't matter.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  if (ah.length !== bh.length) return false;
  return timingSafeEqual(ah, bh);
}

export async function POST(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "ADMIN_SECRET not configured on the server" },
      { status: 503 },
    );
  }

  const ipHash = hashIp(clientIp(req));
  if (ipHash && isRateLimited(`admin-login:${ipHash}`, LOGIN_ATTEMPT_MAX, LOGIN_ATTEMPT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const provided = (body.secret ?? "").trim();
  if (!provided) {
    return NextResponse.json({ error: "secret required" }, { status: 400 });
  }

  if (!constantTimeEqual(provided, adminSecret)) {
    // Don't leak why — just say wrong.
    return NextResponse.json({ error: "incorrect secret" }, { status: 401 });
  }

  // Session token — HMAC-signed with ADMIN_SECRET (see lib/adminSession.ts),
  // so the middleware can verify it's genuine (not just present) without a
  // server-side session store.
  const token = await createAdminSession(adminSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_S,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
