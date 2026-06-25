/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Plain <img> against hipcdn — disabling the built-in optimizer keeps
  // Vercel bandwidth/transform cost at $0.
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  poweredByHeader: false,
  experimental: {
    // Tree-shake barrel-style imports so unused exports don't ship.
    optimizePackageImports: ["@supabase/supabase-js", "@anthropic-ai/sdk"],
    // Client-side router cache: keep dynamic pages warm for 30 s so
    // back-navigation doesn't re-fetch. Static pages already default to 5 min.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
