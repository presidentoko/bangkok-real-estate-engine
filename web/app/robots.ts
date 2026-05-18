import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
  "CCBot",             // Common Crawl (trains most open LLMs)
  "Bytespider",        // ByteDance / Doubao
  "Applebot",          // Apple Intelligence
  "Applebot-Extended", // Apple AI training opt-in
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
      ...AI_AGENTS.map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: ["/admin", "/api"],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
