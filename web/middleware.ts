import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession } from "./lib/adminSession";
import { DEFAULT_LANG, LANGS, type Lang } from "./lib/i18n";

// Paths the middleware should NOT touch with the i18n redirect. /admin and
// /alerts live outside the i18n tree by design (admin is owner-only,
// /alerts is a single-page subscribe flow).
const SKIP_PREFIXES = [
  "/_next",
  "/api",
  "/admin",
  "/alerts",
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image",
  "/favicon",
  "/bangkok-districts.geojson",
];

// Pages under /admin that don't require auth (login itself must be open).
const ADMIN_PUBLIC_PATHS = new Set(["/admin/login"]);

// PERMANENT circuit-breaker (originally added 2026-07-12 as a temporary
// Supabase-egress fix, self-expiring 2026-08-04 -- converted to permanent
// 2026-08-06 once it became clear the underlying driver isn't the old
// Supabase quota at all). Only ~300 condos (x3 langs = 900 pages) are
// prebuilt via generateStaticParams (condo/[slug]/page.tsx); the other
// ~97% of condos render on-demand ISR on first request. A broad bot crawl
// hitting distinct never-before-cached /condo/[slug] URLs means every hit
// is a fresh render + ISR write + origin transfer -- there's no way to
// cache this away since it's a one-time cold-start cost per page, not a
// repeat-request problem. Confirmed 2026-08-06: with this block expired,
// ISR Writes climbed 187K -> 379K and Fast Origin Transfer to 7.59/10GB
// within days. 503 any bot-looking UA hitting /condo/ so already-cached
// pages keep serving real users while bots get turned away before they
// cost anything. Mirrors the precedent in web/app/robots.ts's
// BLOCKED_AGENTS (Bytespider/CCBot were disallowed after an earlier
// egress-quota lockout).
//
// Googlebot/Bingbot are exempted (see SEARCH_ENGINE_UA_RE) -- 2026-07-17
// dropping them from the block list was a direct fix for GSC's "Discovered
// - currently not indexed" count climbing to 21,505 pages while they were
// included. Ranking on Google is the whole point of this site, so those
// two must always pass through regardless of what's driving this block.
const BOT_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|ia_archiver|GPTBot|ClaudeBot|PerplexityBot|YandexBot|PetalBot|AhrefsBot|SemrushBot|MJ12bot|DotBot|Amazonbot/i;

// Anything here is a search crawler whose index we want to be in, so it
// passes even though its UA matches BOT_UA_RE above.
//
// Widened 2026-08-17. The original four covered Googlebot's main crawl but
// not the sibling agents Google uses for the things a site owner actually
// depends on, all of which contain "bot"/"Google" and were therefore being
// answered with a 503:
//
//   Google-InspectionTool  URL Inspection + Rich Results Test. Every "test
//                          live URL" a human ran against a /condo/ page
//                          reported a server error that real Googlebot was
//                          never seeing — a diagnostic that lies.
//   Googlebot-Image        image indexing (hero photos)
//   Googlebot-News         news surfaces
//   Storebot-Google        shopping/product checks
//   AdsBot-Google          landing-page checks; a 503 here degrades quality
//                          scores even with no ads running
//   Google-Safety          abuse review — a site that 503s it looks evasive
//   BingPreview            Bing snapshot fetcher, sibling of Bingbot
//   Yeti / Daum            Naver and Kakao. This site is written by and
//                          partly for Korean readers; Naver is where that
//                          audience searches, and neither crawler was on
//                          the list.
//   DuckDuckBot            small but free to admit.
const SEARCH_ENGINE_UA_RE =
  /Googlebot|GoogleOther|Google-Extended|Google-InspectionTool|Storebot-Google|AdsBot-Google|Google-Safety|Bingbot|BingPreview|Yeti|Daum|DuckDuckBot/i;

// Link-preview fetchers. These are not crawlers: each one fetches exactly
// the URL a human just pasted into a chat or a post, once, to render the
// card. Blocking them cost nothing on the hosting budget and quietly broke
// every share of a /condo/ link — the message renders as a bare URL with no
// title, no image, no numbers, which is the difference between a link
// someone clicks and one they scroll past. For a site with ~15 search
// impressions a day, shared links are not a rounding error.
//
// KakaoTalk and LINE are in here for the same reason Yeti is above.
const SOCIAL_PREVIEW_UA_RE =
  /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|WhatsApp|kakaotalk|Line\/|Pinterest|redditbot|Mastodon|Iframely|Embedly/i;

function pickLang(req: NextRequest): Lang {
  // 1. Cookie wins (explicit user choice)
  const cookie = req.cookies.get("lang")?.value;
  if (cookie && (LANGS as readonly string[]).includes(cookie)) return cookie as Lang;

  // 2. Accept-Language: pick first match against our supported set
  const accept = req.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    const base = tag.split("-")[0];
    if ((LANGS as readonly string[]).includes(base)) return base as Lang;
  }
  return DEFAULT_LANG;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const ua = req.headers.get("user-agent") ?? "";
  if (
    pathname.includes("/condo/") &&
    BOT_UA_RE.test(ua) &&
    !SEARCH_ENGINE_UA_RE.test(ua) &&
    !SOCIAL_PREVIEW_UA_RE.test(ua)
  ) {
    return new NextResponse(
      "Crawling of this section is limited to search engines to protect a " +
        "free-tier hosting budget. Please retry later or contact the site owner.",
      {
        status: 503,
        headers: { "Retry-After": "86400", "Cache-Control": "no-store" },
      }
    );
  }

  // /district/<slug> URL normalisation. regions.name is now always the
  // lowercase-hyphen form (src/db.canonical_region_name), but Google has
  // ~180 indexed /district/x%20y URLs from when the same district existed in
  // the DB under two or three spellings — plus any mixed-case variant that
  // used to resolve via an ilike lookup. Those no longer match a region, so
  // without this they would all turn into fresh 404s.
  //
  // This has to be middleware rather than a permanentRedirect() inside
  // district/[slug]/page.tsx: that route is ISR (revalidate = 604800), so
  // Next has already started streaming the shell by the time a redirect
  // thrown from the page could take effect, and it degrades into a
  // client-side redirect wrapped in a 200 (verified locally — 200 with an
  // empty suspended body). Middleware runs before any rendering, so it can
  // still send a real 308. No extra invocations either: these paths already
  // flow through here for the i18n check below.
  const district = pathname.match(/^\/(en|ko|th)\/district\/(.+)$/);
  if (district) {
    const [, lang, rawSlug] = district;
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSlug);
    } catch {
      decoded = rawSlug; // malformed %-encoding — let the page 404 it
    }
    const canonical = decoded.trim().toLowerCase().replace(/[\s_-]+/g, "-");
    if (canonical && canonical !== rawSlug) {
      const url = req.nextUrl.clone();
      url.pathname = `/${lang}/district/${canonical}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // UUID → slug redirect used to live here as a live, uncached Supabase
  // fetch on every request to a legacy /condo/{uuid} URL. condo/[slug]/page.tsx
  // already handles the same UUID→slug lookup via permanentRedirect(), and
  // that page is ISR-cached (7d) — so the middleware copy was a pure-cost
  // duplicate with no correctness benefit (removed 2026-07-17).

  // Admin gate — runs BEFORE the SKIP_PREFIXES check so we can protect
  // /admin/* with a cookie. The login page itself is public so the user
  // can reach it without already being authed.
  //
  // The cookie value is HMAC-signed (lib/adminSession.ts) with ADMIN_SECRET,
  // so we verify the signature and expiry here rather than just checking
  // that *a* cookie is present — a bare presence check meant anyone could
  // grant themselves access via `document.cookie = "admin_session=x"`.
  if (pathname.startsWith("/admin") && !ADMIN_PUBLIC_PATHS.has(pathname)) {
    const cookie = req.cookies.get("admin_session")?.value;
    const valid = await verifyAdminSession(cookie, process.env.ADMIN_SECRET);
    if (!valid) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      const res = NextResponse.redirect(url);
      // Clear any bogus/expired cookie so it doesn't linger in the browser.
      if (cookie) res.cookies.set("admin_session", "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return;
  if (pathname.includes(".")) return; // any other static asset

  // Already prefixed?
  const seg = pathname.split("/")[1];
  if ((LANGS as readonly string[]).includes(seg)) return;

  // Redirect to /<lang>/<rest>
  const lang = pickLang(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.redirect(url);
  res.cookies.set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export const config = {
  // Exclude static assets, /api, and anything with a file extension at the
  // matcher level so middleware is never invoked for them (Vercel free plan
  // bills edge-middleware invocations). /admin still flows through so the
  // admin cookie gate above can run.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon|robots.txt|sitemap.xml|rss.xml|.*\\..*).*)",
  ],
};
