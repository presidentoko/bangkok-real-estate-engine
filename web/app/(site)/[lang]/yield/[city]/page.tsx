import type { Metadata } from "next";
import { YieldAreaView, yieldAreaMetadata } from "@/components/YieldAreaView";
import { CONDO_STATIC_BUILD } from "@/lib/buildMode";
import { LANGS } from "@/lib/i18n";
import { getYieldAreaIndex } from "@/lib/queries/yieldAreas";

// Rental yield for one city. The figures move with the weekly scrape.
export const revalidate = 604800;

export async function generateStaticParams() {
  if (CONDO_STATIC_BUILD) return [];
  const index = await getYieldAreaIndex();
  return index.cities.flatMap((c) => LANGS.map((lang) => ({ lang, city: c.city })));
}

type Params = { params: Promise<{ lang: string; city: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, city } = await params;
  return yieldAreaMetadata(lang, city);
}

export default async function YieldCityPage({ params }: Params) {
  const { lang, city } = await params;
  return <YieldAreaView lang={lang} city={city} />;
}
