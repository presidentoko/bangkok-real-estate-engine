import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/ContactForm";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Contact — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.contact.title} — RealData`,
    description: t.contact.lead,
    alternates: {
      canonical: `/${lang}/contact`,
      languages: {
        en: `${SITE_URL}/en/contact`,
        ko: `${SITE_URL}/ko/contact`,
        th: `${SITE_URL}/th/contact`,
        "x-default": `${SITE_URL}/en/contact`,
      },
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t.contact.title}</h1>
        <p className="text-zinc-400 text-sm">{t.contact.lead}</p>
      </header>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
        <ContactForm strings={t.contact.form} />
      </div>

      <section className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">
        {t.contact.useCases.map((u) => (
          <div
            key={u.title}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <div className="font-semibold text-zinc-200 mb-1">{u.title}</div>
            <p className="text-zinc-400 leading-relaxed">{u.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
