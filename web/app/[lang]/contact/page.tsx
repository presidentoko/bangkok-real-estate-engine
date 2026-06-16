import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/ContactForm";
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
  return {
    title: "Contact & Concierge — RealData Bangkok",
    description:
      "Property concierge for foreign buyers in Thailand. Get a personalised shortlist, price guidance, and viewing support — or reach our team for advertising and data partnerships.",
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
