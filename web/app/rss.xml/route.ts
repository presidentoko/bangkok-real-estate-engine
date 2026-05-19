// RSS 2.0 feed of the blog. Helps with reader retention and is a small
// SEO + AEO surface (some assistants index RSS for fresh content).

import { getServerSupabase } from "@/lib/supabase";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

const POSTS = [
  { slug: "phuket-bubble-watch", date: "2026-05-09" },
  { slug: "chiang-mai-best-value-2026", date: "2026-05-09" },
  { slug: "bangkok-foreign-buyer-guide-2026", date: "2026-05-07" },
  { slug: "sukhumvit-vs-sathorn-condo-comparison", date: "2026-05-07" },
  { slug: "bangkok-flood-risky-popular", date: "2026-05-07" },
  { slug: "bangkok-foreigner-best-value", date: "2026-05-07" },
  { slug: "bangkok-overpriced-top10", date: "2026-05-06" },
];

const TITLES: Record<string, string> = {
  "phuket-bubble-watch": "Phuket Bubble Watch — Top 10 Overpriced Condos",
  "chiang-mai-best-value-2026": "Chiang Mai Best-Value Condos for Long-Stay Foreigners",
  "bangkok-foreign-buyer-guide-2026": "Bangkok Condo Buyer Guide 2026 — Foreigner's Handbook",
  "sukhumvit-vs-sathorn-condo-comparison": "Sukhumvit vs Sathorn vs Silom Comparison",
  "bangkok-flood-risky-popular": "Popular Bangkok Condos in High Flood-Risk Districts",
  "bangkok-foreigner-best-value": "Best Bangkok Condos for Foreign Investors",
  "bangkok-overpriced-top10": "Top 10 Most Overpriced Bangkok Condos",
};

const DESCRIPTIONS: Record<string, string> = {
  "phuket-bubble-watch": "Data analysis of 63 Phuket condos. Russian/Chinese investor context. Bubble Index ranking.",
  "chiang-mai-best-value-2026": "Underpriced Chiang Mai condos for digital nomads, retirees, long-stay foreigners.",
  "bangkok-foreign-buyer-guide-2026": "Complete guide: 49% quota rule, BTS proximity, central districts, flood risk, taxes, rental yield.",
  "sukhumvit-vs-sathorn-condo-comparison": "Median prices, BTS access, building count, flood profile across the three central condo corridors.",
  "bangkok-flood-risky-popular": "Bangkok buildings with active listings in BMA flood Level 4-5 districts.",
  "bangkok-foreigner-best-value": "Low Bubble Index + high Livability Score. 8 picks for the 49% foreign quota.",
  "bangkok-overpriced-top10": "Buildings priced 3-4× above their district average. Bubble Index analysis.",
};

function escapeXml(s: string): string {
  // Use numeric character references instead of named entities for both
  // the single-quote and double-quote — &apos; / &quot; are valid XML 1.0
  // but HTML-style parsers (including Naver Webmaster Tools' RSS
  // validator) sometimes reject &apos; specifically. &#39; / &#34; are
  // universally accepted.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;");
}

export const revalidate = 3600;

export async function GET() {
  const supabase = getServerSupabase();
  const buildBldgs = await supabase
    .from("condos_published")
    .select("id, name, first_seen_at, regions(name)")
    .order("first_seen_at", { ascending: false })
    .limit(15);

  const recentBldgs = ((buildBldgs.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    first_seen_at: string | null;
    regions: { name: string } | { name: string }[] | null;
  }>).map((b) => {
    const region = (Array.isArray(b.regions) ? b.regions[0] : b.regions)?.name ?? "Thailand";
    return {
      title: `New: ${b.name} (${region})`,
      link: `${SITE_URL}/en/condo/${b.id}`,
      desc: `${b.name} in ${region} — RealData independent report card.`,
      date: b.first_seen_at ?? new Date().toISOString(),
      guid: `condo-${b.id}`,
    };
  });

  const blogItems = POSTS.map((p) => ({
    title: TITLES[p.slug],
    link: `${SITE_URL}/en/blog/${p.slug}`,
    desc: DESCRIPTIONS[p.slug],
    date: new Date(p.date).toISOString(),
    guid: `blog-${p.slug}`,
  }));

  // Interleave: blog posts first (curated), then recent buildings.
  const items = [...blogItems, ...recentBldgs];

  const itemsXml = items
    .map(
      (it) => `
    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${it.link}</link>
      <guid isPermaLink="false">${it.guid}</guid>
      <pubDate>${new Date(it.date).toUTCString()}</pubDate>
      <description>${escapeXml(it.desc)}</description>
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RealData — Thailand condo data analysis</title>
    <link>${SITE_URL}</link>
    <description>Independent measurement of every Thai condo. No influencer marketing.</description>
    <language>en</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
