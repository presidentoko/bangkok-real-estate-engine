// The Cloudflare condo export (scripts/condo_static/, lib/buildMode.ts).
// Its HTML is served from Cloudflare while every other page stays on Vercel,
// so its JS/CSS must not collide with the Vercel deployment's /_next/static:
// assetPrefix moves them under /cfs, which a separate Worker serves. A fixed
// build id keeps chunk URLs stable across the batched builds of one export.
const CONDO_STATIC_BUILD = process.env.CONDO_STATIC_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(CONDO_STATIC_BUILD
    ? {
        assetPrefix: "/cfs",
        generateBuildId: async () => process.env.CONDO_STATIC_BUILD_ID || "condo-static",
      }
    : {}),
  // Plain <img> against hipcdn — disabling the built-in optimizer keeps
  // Vercel bandwidth/transform cost at $0.
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  poweredByHeader: false,
  async redirects() {
    // /sitemap-condos.xml?page=N -> /sitemap-condos/N.
    //
    // The old handler read the page out of `?page=`, which made it a dynamic
    // route: Next strips a dynamic handler's Cache-Control to a bare
    // `public`, so the s-maxage=86400 it set never reached the CDN and every
    // crawler fetch answered `x-vercel-cache: MISS` — ten paginated Supabase
    // reads, 5.65s, ~120KB from the origin, each time. Measured 2026-08-20
    // with the project at 9.79GB of a 10GB Fast Origin Transfer cap.
    //
    // Google, Bing, Yandex and Naver all still hold the old URL. Doing this
    // in config rather than in a route handler means the 308 is served by the
    // platform, with no function invocation at all.
    return [
      {
        source: "/sitemap-condos.xml",
        has: [{ type: "query", key: "page", value: "(?<page>\\d+)" }],
        destination: "/sitemap-condos/:page.xml",
        permanent: true,
      },
      {
        source: "/sitemap-condos.xml",
        destination: "/sitemap-condos/0.xml",
        permanent: true,
      },
    ];
  },
  experimental: {
    // Tree-shake barrel-style imports so unused exports don't ship.
    optimizePackageImports: ["@supabase/supabase-js", "@anthropic-ai/sdk"],
    // Client-side router cache: keep dynamic pages warm for 30 s so
    // back-navigation doesn't re-fetch. Static pages already default to 5 min.
    staleTimes: {
      dynamic: 30,
    },
    // Export build only: a transient Supabase error should retry the page,
    // not fail a shard of thousands.
    ...(CONDO_STATIC_BUILD ? { staticGenerationRetryCount: 3 } : {}),
  },
};

export default nextConfig;
