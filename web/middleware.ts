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
const SEARCH_ENGINE_UA_RE = /Googlebot|GoogleOther|Google-Extended|Bingbot/i;

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
    !SEARCH_ENGINE_UA_RE.test(ua)
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
