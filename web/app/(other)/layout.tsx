import "../globals.css";
import type { Metadata, Viewport } from "next";

// Root layout (owns <html>/<body>) for everything outside the localized
// site — /admin (owner-only) and /alerts (single-page subscribe flow), per
// middleware.ts's SKIP_PREFIXES comment: both live outside the i18n tree by
// design. English-only, no locale switching, so a fixed lang is correct
// here (unlike (site)/[lang]/layout.tsx, which sets it per-locale).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RealData — Thailand Condo Report Card",
  description:
    "Data-verified truth on Thai condos: Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin. District averages, OSM, BMA flood maps, news signal — no influencers.",
  // Matches the original app/layout.tsx default exactly — /admin is kept
  // out of search via robots.txt's Disallow: /admin (and its own auth
  // gate), not a meta tag here; /alerts is a real public page and was never
  // noindexed.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function OtherRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
