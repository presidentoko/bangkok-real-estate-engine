import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/ContactForm";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Contact — RealData" };
  const t = getDictionary(lang).contact;
  const title = `${t.title} — RealData`;
  const description = t.lead;
  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/contact`,
      languages: langAlternates("/contact"),
    },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}/contact` }),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  return (
    <main className="max-w-2xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Contact us</h1>
        <p className="text-zinc-400 text-sm">
          Property concierge, advertising, or data partnerships — fill in the form and we&apos;ll be
          in touch.
        </p>
      </header>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
        <ContactForm />
      </div>
    </main>
  );
}
