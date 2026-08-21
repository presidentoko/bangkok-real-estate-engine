import type { MetadataRoute } from "next";

import { condoCrawlThrottled } from "@/lib/crawlThrottle";

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
//
// This list is now tied to the throttle deadline rather than permanent:
// middleware's ANSWER_ENGINE_UA_RE lets exactly this set through on exactly
// the same date, both reading CRAWL_THROTTLE_UNTIL, so the advertised block
// and the enforced one cannot drift apart. Being cited by these is the point
// of the site; the block was only ever about origin bytes.
const CONDO_BLOCKED_WHILE_THROTTLED = [
  "OAI-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
  "Applebot",
  "Applebot-Extended",
];

// Blocked from /condo/ permanently. GPTBot is a training crawler with no
// citation surface — OpenAI's reader-facing fetches come from OAI-SearchBot
// and ChatGPT-User — so ~46,000 cold renders buys nothing measurable.
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

// The /condo/ block lapses on a date, so this file cannot be baked once at
// build time — it would keep advertising a block that middleware has already
// stopped enforcing. A day is close enough: the deadline is a budget cycle,
// not a deploy.
export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  const condoBlocked = new Set(
    condoCrawlThrottled()
      ? [...CONDO_BLOCKED_ALWAYS, ...CONDO_BLOCKED_WHILE_THROTTLED]
      : CONDO_BLOCKED_ALWAYS
  );

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
