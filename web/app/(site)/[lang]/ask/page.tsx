import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AskChat } from "@/components/AskChat";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";

// Static shell — the chat itself is a client component hitting /api/ask.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Ask RealData" };
  const t = getDictionary(lang).seo;
  const title = t.askTitle;
  const description = t.askDesc;
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/ask`,
      languages: langAlternates("/ask"),
    },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}/ask` }),
  };
}

export default async function AskPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang).tools;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t.askTitle}</h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          {t.askLead}
        </p>
      </header>

      <AskChat />
    </main>
  );
}
