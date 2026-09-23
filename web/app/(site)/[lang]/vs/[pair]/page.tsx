import type { Metadata } from "next";
import { AreaVsView, areaVsMetadata } from "@/components/AreaVsView";
import { CONDO_STATIC_BUILD } from "@/lib/buildMode";
import { COMPARE_PAIRS } from "@/lib/comparePairs";
import { LANGS } from "@/lib/i18n";
import { getComparison } from "@/lib/queries/areaCompare";

// Prices and yields move with the weekly scrape.
export const revalidate = 604800;

/** Only pairs whose both sides clear the data bar are built; the rest 404
 *  rather than shipping a comparison with an empty column. */
export async function generateStaticParams() {
  if (CONDO_STATIC_BUILD) return [];
  const usable = await Promise.all(
    COMPARE_PAIRS.map(async (p) => ((await getComparison(p)) ? p.slug : null)),
  );
  return usable
    .filter((slug): slug is string => slug != null)
    .flatMap((pair) => LANGS.map((lang) => ({ lang, pair })));
}

type Params = { params: Promise<{ lang: string; pair: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, pair } = await params;
  return areaVsMetadata(lang, pair);
}

export default async function AreaVsPage({ params }: Params) {
  const { lang, pair } = await params;
  return <AreaVsView lang={lang} slug={pair} />;
}
