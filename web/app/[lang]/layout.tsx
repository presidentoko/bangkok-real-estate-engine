import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LangSwitcher } from "@/components/LangSwitcher";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS } from "@/lib/i18n";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  ko: "ko_KR",
  th: "th_TH",
};

export async function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  return {
    alternates: {
      canonical: `/${lang}`,
      languages: {
        en: `${SITE_URL}/en`,
        ko: `${SITE_URL}/ko`,
        th: `${SITE_URL}/th`,
        "x-default": `${SITE_URL}/en`,
      },
    },
    openGraph: {
      locale: OG_LOCALE[lang],
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    },
  };
}

export default async function LangLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  // Site-wide structured data: Organization + WebSite. Renders once per page
  // because layouts are not deduped across nested route segments — keeping it
  // here (not root) means we get inLanguage right per locale.
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: t.brand.name,
        url: SITE_URL,
        description: t.footer.about,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: t.brand.name,
        url: `${SITE_URL}/${lang}`,
        inLanguage: lang,
        publisher: { "@id": `${SITE_URL}/#org` },
      },
    ],
  };

  const NAV = [
    { href: `/${lang}/flood`, label: t.nav.flood },
    { href: `/${lang}/inventory`, label: t.nav.inventory },
    { href: `/${lang}/reality`, label: t.nav.reality },
    { href: `/${lang}/blog`, label: t.nav.blog },
    { href: `/${lang}/contact`, label: t.nav.contact },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href={`/${lang}`} className="font-black text-lg tracking-tight">
            <span className="text-blue-400">Real</span>{t.brand.name.replace("Real", "")}
            <span className="hidden sm:inline text-zinc-600 font-normal text-xs ml-2">
              Bangkok
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
              >
                {n.label}
              </Link>
            ))}
            <LangSwitcher current={lang} />
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-12 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="font-black tracking-tight mb-2">
              <span className="text-blue-400">Real</span>Data
            </div>
            <p className="text-zinc-500 leading-relaxed">{t.footer.about}</p>
          </div>
          <div>
            <div className="text-zinc-300 font-semibold mb-2">{t.footer.sectionsTitle}</div>
            <ul className="space-y-1 text-zinc-500">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-zinc-300">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-zinc-300 font-semibold mb-2">{t.footer.sourcesTitle}</div>
            <ul className="space-y-1 text-zinc-500 text-xs leading-relaxed">
              {t.footer.sources.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-900 px-4 sm:px-6 py-4 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} RealData · {t.footer.copyright}
        </div>
      </footer>
    </>
  );
}
