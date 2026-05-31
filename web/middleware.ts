import { NextResponse, type NextRequest } from "next/server";
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin gate — runs BEFORE the SKIP_PREFIXES check so we can protect
  // /admin/* with a cookie. The login page itself is public so the user
  // can reach it without already being authed.
  if (pathname.startsWith("/admin") && !ADMIN_PUBLIC_PATHS.has(pathname)) {
    const cookie = req.cookies.get("admin_session")?.value;
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
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
