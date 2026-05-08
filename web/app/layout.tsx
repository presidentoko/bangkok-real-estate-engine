import "./globals.css";
import type { Metadata } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "RealData — Bangkok Condo Report Card",
  description:
    "Data-verified truth on Bangkok condos. Powered by district averages, OSM, BMA flood maps, and news signal — not influencers.",
  openGraph: {
    siteName: "RealData",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
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
