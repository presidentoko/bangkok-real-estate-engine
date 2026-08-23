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

// Blocked from /condo/. GPTBot is a training crawler with no citation
// surface — OpenAI's reader-facing fetches come from OAI-SearchBot and
// ChatGPT-User, both of which are allowed — so ~12,800 cold renders of the
// least quotable pages on the site buys nothing measurable.
//
// This must stay in step with middleware.ts: anything listed here is 503d
// there by falling through both SEARCH_ENGINE_UA_RE and ANSWER_ENGINE_UA_RE.
// Telling a crawler "Allow: /" and then refusing every request is worse than
// being honest — repeated 503s read as an unstable origin, and a crawler
// that backs off sitewide costs us the pages we do want indexed.
//
// The answer engines that used to sit on a second, deadline-gated list here
// (OAI-SearchBot, ClaudeBot, PerplexityBot, Applebot) were released on
// 2026-08-23, when a Cloudflare Cache Rule made repeat crawls cost no origin
// bytes. See middleware.ts for that accounting.
const CONDO_BLOCKED_ALWAYS = ["GPTBot"];

const CONDO_PATHS = ["/en/condo/", "/ko/condo/", "/th/condo/"];

// Ad-serving fetchers. These need their own records for two separate
// reasons:
//
//   AdsBot-Google (and -Mobile) ignore the wildcard "*" record by design —
//   Google documents this — so the allow above does not reach them and only
//   an explicit record does. They fetch a landing page to score it; a block
//   or a 503 reads as "page unavailable".
//
//   Mediapartners-Google is what fetches a page to decide which ads to show
//   on it. Block it and the slots either stay blank or fill with untargeted
//   inventory, which is the difference between an RPM worth having and one
//   that isn't.
//
// Neither is a catalogue crawler, so /condo/ stays open to both even while
// CONDO_BLOCKED_AGENTS applies to the answer engines; see the matching
// AD_FETCHER_UA_RE exemption in middleware.ts.
const AD_AGENTS = [
  "Mediapartners-Google",
  "AdsBot-Google",
  "AdsBot-Google-Mobile",
];

// Heavy, high-volume crawlers with no meaningful SEO/AEO payoff for this
// site. A wildcard "*" allow rule doesn't block them by itself — each needs
// its own disallow record. Removed 2026-07 after they contributed to a
// Supabase egress-quota lockout on a low-traffic project.
const BLOCKED_AGENTS = [
  "Bytespider", // ByteDance — no discovery/citation value here, very heavy
  "CCBot",      // Common Crawl — diffuse benefit, very heavy
];

// Kept on a daily revalidate so an edit to the block lists reaches
// robots.txt without waiting for the next deploy.
export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  const condoBlocked = new Set(CONDO_BLOCKED_ALWAYS);

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
      ...AI_AGENTS.map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: condoBlocked.has(ua)
          ? ["/admin", "/api", ...CONDO_PATHS]
          : ["/admin", "/api"],
      })),
      ...AD_AGENTS.map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: ["/admin", "/api"],
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
