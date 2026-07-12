import { createHash } from "crypto";

// Shared helpers for the API routes that need basic abuse protection
// (contact, alerts/subscribe, admin/login). Kept intentionally simple —
// no Redis/external store, since this is a single small Vercel Hobby
// deployment and in-memory (reset on cold start) is an acceptable
// trade-off for the traffic this site gets.

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha1").update(ip).digest("hex");
}

export function clientIp(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    null
  );
}

// In-memory sliding-window rate limiter, keyed by caller-supplied string
// (usually a hashed IP, optionally namespaced per-route so different
// routes don't share a bucket). Resets on serverless cold-start — a
// determined attacker spread across regions/instances can slip past it,
// but it stops the common case (one client hammering one endpoint).
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= max) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  // light GC — drop the oldest entries once the map grows too large
  if (buckets.size > 5000) {
    const oldest = Array.from(buckets.entries())
      .map(([k, v]) => [k, Math.max(...v)] as [string, number])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 1000);
    for (const [k] of oldest) buckets.delete(k);
  }
  return false;
}
