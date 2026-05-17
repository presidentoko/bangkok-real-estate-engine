import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AskChat } from "@/components/AskChat";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

// Chat needs to be live; don't ISR/static.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Ask RealData" };
  const title = "Ask RealData — AI condo research for Thailand";
  const description =
    "Ask any question about Bangkok and Thailand condos — yields, prices, comparisons, " +
    "flood risk, mortgage spread. Answers are grounded in measured data across 4 portals " +
    "and Bank of Thailand macro indicators.";
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/ask`,
      languages: langAlternates("/ask"),
    },
    openGraph: { title, description, url: `${SEO_SITE_URL}/${lang}/ask`, type: "website" },
  };
}

export default async function AskPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Ask RealData</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          Property research grounded in our measured data — 8,000+ condos,
          90,000+ listings across hipflat, dotproperty, ddproperty, fazwaz,
          plus Bank of Thailand macro indicators (MRR, MLR, policy rate).
          No marketing fluff, no influencer claims — just numbers we track.
        </p>
      </header>

      <AskChat />
    </main>
  );
}
