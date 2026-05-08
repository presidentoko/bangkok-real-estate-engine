import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RealData — Bangkok Condo Report Card",
  description:
    "Data-verified truth on Bangkok condos. Powered by district averages, OSM, BMA flood maps, and news signal — not influencers.",
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
