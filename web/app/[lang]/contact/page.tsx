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

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <a
          href="mailto:thaiconnect33@gmail.com"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition"
        >
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Email</div>
          <div className="font-bold text-zinc-100 break-all text-sm">thaiconnect33@gmail.com</div>
        </a>
        <a
          href="https://line.me/ti/p/~838wyfih"
          target="_blank"
          rel="noopener"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition"
        >
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">LINE</div>
          <div className="font-bold text-zinc-100 text-sm">@838wyfih</div>
        </a>
        <a
          href="https://wa.me/66610934014"
          target="_blank"
          rel="noopener"
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition"
        >
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">WhatsApp / Phone</div>
          <div className="font-bold text-zinc-100 text-sm">+66 61 093 4014</div>
        </a>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Bangkok office</div>
          <div className="text-zinc-200 text-xs leading-snug">
            3rd floor, 272 Than Thip 3 Alley<br />
            Phlabphla, Wang Thonglang<br />
            Bangkok 10310
          </div>
        </div>
      </div>

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
