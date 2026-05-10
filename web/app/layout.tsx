import "./globals.css";
import type { Metadata, Viewport } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RealData — Thailand Condo Report Card",
  description:
    "Data-verified truth on Thai condos: Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin. District averages, OSM, BMA flood maps, news signal — no influencers.",
  openGraph: {
    siteName: "RealData",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

// Next 14+: theme-color belongs on the viewport export, not metadata.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Speed up the LCP: condo hero images all live on img.hipcdn.com,
            so opening that connection in parallel with HTML parse buys ~150ms
            on first card paint. */}
        <link rel="preconnect" href="https://img.hipcdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://img.hipcdn.com" />
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
