import "../../globals.css";
import type { Metadata, Viewport } from "next";
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
import { jsonLdString } from "@/lib/seo/safeJsonLd";

// This is a ROOT layout (owns <html>/<body>) for the (site) route group —
// there is no top-level app/layout.tsx. Next.js only passes route params to
// the segment that owns them and its descendants, never to an ancestor, so
// a single shared app/layout.tsx could never read [lang] to set <html
// lang>. It shipped hardcoded to "en" for every locale (patched client-side
// via a <script>, which fixed browsers but left the initial SSR HTML wrong
// for /ko and /th — what non-JS crawlers and screen readers see first;
// found in the 2026-07-31 audit). Splitting into per-group root layouts
// (this one, and (other)/layout.tsx for /admin + /alerts) lets each one set
// the right <html lang> from the start. See
// https://nextjs.org/docs/app/building-your-application/routing/route-groups#opting-specific-segments-into-a-layout
// No `dynamicParams = false` here, even though LANGS is a closed set —
// tried it, and it broke on-demand ISR fallback for EVERY nested dynamic
// route not in its own generateStaticParams (condo/[slug], district/[slug]:
// every non-prebuilt condo/district 404'd, confirmed by testing 3 known-good
// slugs that all returned 200 before this was added and 404 after). Setting
// dynamicParams=false on an ancestor segment apparently constrains fallback
// rendering for its descendants too, not just its own param — not documented
// behavior we want to rely on. Invalid /xx/... still 404s via the
// isLang(lang) check below, just without the router-level guarantee.

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
  // Merges what used to be split across app/layout.tsx (static, lang-
  // independent) and this file's own generateMetadata (per-lang alternates
  // + openGraph locale) — collapsed into one function now that both live in
  // the same layout. Page-level generateMetadata still overrides/extends
  // this per Next's normal metadata merge.
  return {
    metadataBase: new URL(SITE_URL),
    title: "RealData — Thailand Condo Report Card",
    description:
      "Data-verified truth on Thai condos: Bangkok, Phuket, Chiang Mai, Pattaya, Hua Hin. District averages, OSM, BMA flood maps, news signal — no influencers.",
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
      siteName: "RealData",
      type: "website",
      locale: OG_LOCALE[lang],
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

// Set in Vercel (Project -> Settings -> Environment Variables) once the
// Cloudflare Web Analytics site is created. Read at module scope so the
// value is inlined at build time like every other NEXT_PUBLIC_ var.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export default async function LangRootLayout({
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
    <html lang={lang}>
      <head>
        {/* Speed up the LCP: condo hero images all live on img.hipcdn.com,
            so opening that connection in parallel with HTML parse buys ~150ms
            on first card paint. */}
        <link rel="preconnect" href="https://img.hipcdn.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://img.hipcdn.com" />
        {/* Agoda Partner Hub site verification — meta-tag method (redundant
            with /AgodaPartnerVerification.html so Agoda passes regardless
            of which check they actually run). */}
        <meta name="agd-partner-manual-verification" />
        {/* Cloudflare Web Analytics. Until 2026-08-17 this site had no
            analytics of any kind — not gtag, not Plausible, not Vercel
            Analytics — so "users aren't coming" could only ever be answered
            from Search Console impressions, which say what Google showed,
            never what a visitor did after arriving. CF Web Analytics is the
            one option that is free with no event cap, needs no cookie
            banner (no cookies, no fingerprinting), and adds no first-party
            JS bundle.

            Env-gated on purpose: the token comes from the Cloudflare
            dashboard (Web Analytics -> Add a site), and until
            NEXT_PUBLIC_CF_BEACON_TOKEN is set in Vercel this renders
            nothing at all rather than shipping a broken beacon. */}
        {CF_BEACON_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
          />
        )}
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(siteJsonLd) }}
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
                  {/* The 154 /district/ pages carry the most rankable
                      content on the site (median sale/rent/yield for a
                      named area) and had no entry point at all outside
                      individual condo pages until 2026-08-17. */}
                  <Link href={`/${lang}/districts`} className="hover:text-zinc-300">
                    {t.districtsIndex.title}
                  </Link>
                </li>
                <li>
                  <Link href={`/${lang}/yields`} className="hover:text-zinc-300">
                    {t.nav.yields}
                  </Link>
                </li>
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
      </body>
    </html>
  );
}
