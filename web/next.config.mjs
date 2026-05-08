/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We render condo photos via plain <img> against hipcdn — disabling the
  // built-in image optimizer keeps the Vercel bandwidth/transform bill at $0.
  images: { unoptimized: true },
  // ts/eslint warnings shouldn't block production deploy; CI runs strict checks
  // via tsc --noEmit before push, and lint is a separate dev concern.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  // Slightly trim shipped JS by skipping the X-Powered-By header.
  poweredByHeader: false,
};

export default nextConfig;
