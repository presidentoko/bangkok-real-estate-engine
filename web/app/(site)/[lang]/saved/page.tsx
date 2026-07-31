import type { Metadata } from "next";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { SavedContent } from "./SavedContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Saved condos — RealData" };
  return {
    title: "Saved condos — RealData",
    description: "Your saved Bangkok condo shortlist.",
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/saved`,
      languages: langAlternates("/saved"),
    },
    robots: { index: false },
  };
}

export default async function SavedPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Saved condos</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Stored locally in your browser. Clearing browser data will remove this
          list.
        </p>
      </header>
      <SavedContent lang={isLang(lang) ? lang : "en"} />
    </div>
  );
}
