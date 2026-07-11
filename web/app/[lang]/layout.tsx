import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CitySwitcher } from "@/components/CitySwitcher";
import { CondoSearch } from "@/components/CondoSearch";
import { LangSwitcher } from "@/components/LangSwitcher";
import { MobileMenu } from "@/components/MobileMenu";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { BackToTop } from "@/components/BackToTop";
import { CompareTray } from "@/components/CompareTray";
import { SavedNavLink } from "@/components/SavedNavLink";
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
    // No canonical here — each page sets its own (otherwise every /ko/* page
    // signals canonical=/ko, telling Google all /ko/* are duplicates).
    alternates: {
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
    { href: `/${lang}/data`, label: t.nav.data },
    { href: `/${lang}/blog`, label: t.nav.blog },
    { href: `/${lang}/retiree`, label: t.nav.retiree },
    { href: `/${lang}/about`, label: t.nav.about },
    { href: `/${lang}/contact`, label: t.nav.contact },
  ];

  const MOBILE_NAV = [
    ...NAV,
    { href: `/${lang}/saved`, label: t.footer.saved },
  ];

  return (
    <>
      {/* Root layout pins <html lang="en"> at SSR. Patch it client-side so the
          browser, Lighthouse, and JS-rendering crawlers see the right locale. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(lang)}`,
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href={`/${lang}`} className="font-black text-lg tracking-tight">
              <span className="text-blue-400">Real</span>{t.brand.name.replace("Real", "")}
            </Link>
            {/* CitySwitcher calls useSearchParams(); without a Suspense
                boundary that forces EVERY page under this layout to bail out
                of static rendering into client-side rendering — the SSR'd
                <body> shipped empty (found 2026-07-11: JSON-LD, h1, all
                content invisible to non-JS crawlers, killing AEO). The
                boundary confines the deferral to this one widget. */}
            <Suspense fallback={null}>
              <CitySwitcher lang={lang} />
            </Suspense>
          </div>
          <div className="flex items-center gap-1 sm:gap-3 text-sm">
            <div className="hidden md:block">
              <CondoSearch lang={lang} />
            </div>
            <div className="hidden sm:flex items-center gap-1 sm:gap-3">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-2 py-1 rounded text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                >
                  {n.label}
                </Link>
              ))}
              <SavedNavLink lang={lang} label={t.footer.saved} />
            </div>
            <LangSwitcher current={lang} />
            <MobileMenu links={MOBILE_NAV} lang={lang} />
          </div>
        </nav>
      </header>

      <main className="flex-1 pb-16 sm:pb-0">{children}</main>

      <CompareTray />
      <BackToTop />
      <MobileBottomNav lang={lang} />

      <footer className="mt-12 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
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
              <li>
                <Link href={`/${lang}/stale`} className="hover:text-zinc-300">
                  {t.stale.title}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/press`} className="hover:text-zinc-300">
                  {t.press.title}
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="hover:text-zinc-300">
                  {t.footer.underpricedAlerts}
                </Link>
              </li>
              <li>
                <Link href="/rss.xml" className="hover:text-zinc-300">
                  {t.footer.rssFeed}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-zinc-300 font-semibold mb-2">{t.footer.sourcesTitle}</div>
            <ul className="space-y-1 text-zinc-500 text-xs leading-relaxed">
              {t.footer.sources.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-zinc-300 font-semibold mb-2">{t.footer.guidesTitle}</div>
            <ul className="space-y-1 text-zinc-500">
              <li><Link href={`/${lang}/guide/foreign-ownership`} className="hover:text-zinc-300">{t.footer.guideForeignOwnership}</Link></li>
              <li><Link href={`/${lang}/guide/investment`} className="hover:text-zinc-300">{t.footer.guideInvestment}</Link></li>
              <li><Link href={`/${lang}/glossary`} className="hover:text-zinc-300">{t.footer.guideGlossary}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-900 px-4 sm:px-6 py-4 pb-20 sm:pb-4 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} RealData · {t.footer.copyright}
        </div>
      </footer>
    </>
  );
}
