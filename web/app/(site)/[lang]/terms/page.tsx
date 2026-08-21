import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LegalDoc from "@/components/LegalDoc";
import { isLang } from "@/lib/i18n";
import { TERMS } from "@/lib/legal/terms";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Terms of Use — RealData" };
  const doc = TERMS[lang];
  return {
    title: `${doc.title} — RealData`,
    description: doc.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/terms`,
      languages: langAlternates("/terms"),
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <LegalDoc doc={TERMS[lang]} />;
}
