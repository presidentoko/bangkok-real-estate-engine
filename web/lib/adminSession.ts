// Signs and verifies the `admin_session` cookie value.
//
// Previously the login route just wrote a random token to the cookie and
// the middleware only checked that *some* cookie was present — so
// `document.cookie = "admin_session=x"` in devtools granted access to
// /admin/leads (which exposes lead PII: names/emails/phones). See
// middleware.ts and app/api/admin/login/route.ts.
//
// Fix: the cookie value is now `${expiryMs}.${hmac}` where hmac is
// HMAC-SHA256(ADMIN_SECRET, expiryMs). Anyone can still *read* the cookie,
// but they can't *forge* one without knowing ADMIN_SECRET, and it expires.
//
// This uses only the Web Crypto API (`crypto.subtle`), which is available
// both in the Next.js Edge runtime (middleware.ts always runs on Edge) and
// in modern Node.js (the /api/admin/login route runs on Node), so the same
// sign/verify logic works in both places without duplication.

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days, matches the old cookie maxAge

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mint a new signed session token to store in the `admin_session` cookie. */
export async function createAdminSession(secret: string): Promise<string> {
  const expiry = Date.now() + SESSION_TTL_MS;
  const sig = await hmacHex(secret, String(expiry));
  return `${expiry}.${sig}`;
}

/**
 * Verify a token produced by createAdminSession. Returns false for
 * missing/malformed/expired/tampered tokens — never throws, so callers can
 * use it directly in a boolean gate.
 */
export async function verifyAdminSession(
  token: string | undefined | null,
  secret: string | undefined | null,
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expiryStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!expiryStr || !sig) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const expected = await hmacHex(secret, expiryStr);
  return timingSafeEqualStr(expected, sig);
}

export const ADMIN_SESSION_MAX_AGE_S = SESSION_TTL_MS / 1000;
