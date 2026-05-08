// Lightweight admin auth — single shared secret in env, sent via header.
// Sufficient for solo-operator MVP. Replace with proper auth (Clerk / NextAuth)
// before opening admin to multiple people.

export function checkAdminSecret(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // refuse if misconfigured
  const provided = req.headers.get("x-admin-secret");
  return provided === secret;
}
