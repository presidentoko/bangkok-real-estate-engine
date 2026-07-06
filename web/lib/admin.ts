// Lightweight admin auth. Sufficient for solo-operator MVP. Replace with
// proper auth (Clerk / NextAuth) before opening admin to multiple people.
//
// Two ways to authenticate:
//  1. `x-admin-secret` header === ADMIN_SECRET — for direct/script access.
//  2. A valid, HMAC-signed `admin_session` cookie (see lib/adminSession.ts) —
//     this is what browser forms under /admin/* should rely on, since the
//     page itself is already gated by middleware.ts. Using the cookie means
//     the client never needs to hold the raw ADMIN_SECRET in JS/localStorage.

import { verifyAdminSession } from "@/lib/adminSession";

function parseCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export async function checkAdminAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // refuse if misconfigured

  const provided = req.headers.get("x-admin-secret");
  if (provided === secret) return true;

  const sessionCookie = parseCookie(req, "admin_session");
  return verifyAdminSession(sessionCookie, secret);
}
