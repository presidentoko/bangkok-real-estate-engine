import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminSession } from "./lib/adminSession";
import { DEFAULT_LANG, LANGS, type Lang } from "./lib/i18n";

const CONDO_UUID_PATH_RE = /^\/([a-z]{2})\/condo\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // UUID → slug permanent redirect: runs before ISR cache so Googlebot gets 308.
  const uuidMatch = pathname.match(CONDO_UUID_PATH_RE);
  if (uuidMatch) {
    const [, lang, uuid] = uuidMatch;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/condos_published?select=slug&id=eq.${uuid}&limit=1`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        const data: Array<{ slug: string | null }> = await res.json();
        if (Array.isArray(data) && data[0]?.slug) {
          const url = req.nextUrl.clone();
          url.pathname = `/${lang}/condo/${data[0].slug}`;
          return NextResponse.redirect(url, { status: 308 });
        }
      } catch {
        // fall through to page handler
      }
    }
  }

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
