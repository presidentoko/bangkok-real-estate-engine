import type { Metadata } from "next";
import { YieldAreaView, yieldAreaMetadata } from "@/components/YieldAreaView";
import { CONDO_STATIC_BUILD } from "@/lib/buildMode";
import { LANGS } from "@/lib/i18n";
import { getYieldAreaIndex } from "@/lib/queries/yieldAreas";

// Rental yield for one district. The figures move with the weekly scrape.
export const revalidate = 604800;

export async function generateStaticParams() {
  if (CONDO_STATIC_BUILD) return [];
  const index = await getYieldAreaIndex();
  return index.cities.flatMap((c) =>
    c.districts.flatMap((d) => LANGS.map((lang) => ({ lang, city: c.city, district: d.district }))),
  );
}

type Params = { params: Promise<{ lang: string; city: string; district: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, city, district } = await params;
  return yieldAreaMetadata(lang, city, district);
}

export default async function YieldDistrictPage({ params }: Params) {
  const { lang, city, district } = await params;
  return <YieldAreaView lang={lang} city={city} district={district} />;
}
