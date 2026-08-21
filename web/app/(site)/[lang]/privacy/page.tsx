import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDoc from "@/components/LegalDoc";
import { isLang } from "@/lib/i18n";
import { PRIVACY } from "@/lib/legal/privacy";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Privacy Policy — RealData" };
  const doc = PRIVACY[lang];
  return {
    title: `${doc.title} — RealData`,
    description: doc.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/privacy`,
      languages: langAlternates("/privacy"),
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalDoc doc={PRIVACY[lang]} />;
}
