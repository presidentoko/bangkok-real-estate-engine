import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

// Explicit allow rules for the major AI training + answer-engine crawlers.
// Wildcard already covers them, but spelling them out (1) makes intent
// auditable, (2) survives the case where a vendor cohort their bot under
// a stricter default, and (3) acts as a counter-signal to repos/sites
// that wholesale block AI bots — we *want* to be cited.
const AI_AGENTS = [
  "GPTBot",            // OpenAI training
  "ChatGPT-User",      // OpenAI live answer / link reads
  "OAI-SearchBot",     // OpenAI SearchGPT
  "ClaudeBot",         // Anthropic training
  "Claude-Web",        // Anthropic live reads
  "anthropic-ai",      // legacy Anthropic UA
  "PerplexityBot",     // Perplexity index
  "Perplexity-User",   // Perplexity live reads
  "Google-Extended",   // Bard/Gemini training opt-in
  "GoogleOther",       // Google research crawl
  "Bingbot",           // Bing + Copilot
  "Applebot",          // Apple Intelligence
  "Applebot-Extended", // Apple AI training opt-in
];

// Agents whose UA matches middleware.ts's BOT_UA_RE without the
// Googlebot/Bingbot exemption, so /condo/ answers them with a 503 no matter
// what this file says. Telling them "Allow: /" and then refusing every
// request is worse than being honest: repeated 503s read as an unstable
// origin, and a crawler that backs off sitewide because of them costs us the
// pages we actually want indexed.
//
// The trade is deliberate and narrow. Everything with citable analysis —
// /flood, /yields, /macro, /data, /reality, /blog, /glossary, /guide — stays
// fully open to these agents. What's closed is the ~12.4k per-building pages
// x3 locales, which are the least quotable content on the site and the most
// expensive to serve: only 300 are prebuilt, so every crawl of the long tail
// is a cold render plus an ISR write (that fan-out is what put the free tier
// 90% over on ISR writes; see middleware.ts).
//
// Applebot is in here for the same mechanical reason, but it is a search
// crawler rather than an answer engine — if Apple referral traffic ever
// matters, it belongs in middleware's SEARCH_ENGINE_UA_RE next to
// Googlebot/Bingbot instead of on this list.
const CONDO_BLOCKED_AGENTS = new Set([
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
  "Applebot",
  "Applebot-Extended",
]);

const CONDO_PATHS = ["/en/condo/", "/ko/condo/", "/th/condo/"];

// Heavy, high-volume crawlers with no meaningful SEO/AEO payoff for this
// site. A wildcard "*" allow rule doesn't block them by itself — each needs
// its own disallow record. Removed 2026-07 after they contributed to a
// Supabase egress-quota lockout on a low-traffic project.
const BLOCKED_AGENTS = [
  "Bytespider", // ByteDance — no discovery/citation value here, very heavy
  "CCBot",      // Common Crawl — diffuse benefit, very heavy
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
      ...AI_AGENTS.map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: CONDO_BLOCKED_AGENTS.has(ua)
          ? ["/admin", "/api", ...CONDO_PATHS]
          : ["/admin", "/api"],
      })),
      ...BLOCKED_AGENTS.map((ua) => ({
        userAgent: ua,
        disallow: "/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
