import type { Metadata } from "next";
import { LANGS } from "@/lib/i18n";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

/** og:locale wants a full BCP-47-with-region tag; a bare "en" is invalid. */
export const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  ko: "ko_KR",
  th: "th_TH",
};

/**
 * Build the `alternates.languages` map for a path. Each generateMetadata
 * should call this with its own path so hreflang points to the same page
 * in every locale (not the locale root).
 *
 *   langAlternates("/condo/abc")
 *   → { en: ".../en/condo/abc", ko: ".../ko/condo/abc", th: ".../th/condo/abc",
 *       "x-default": ".../en/condo/abc" }
 */
export function langAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = { "x-default": `${SITE_URL}/en${path}` };
  for (const l of LANGS) out[l] = `${SITE_URL}/${l}${path}`;
  return out;
}

export const SEO_SITE_URL = SITE_URL;

type OgImages = NonNullable<NonNullable<Metadata["openGraph"]>["images"]>;

/**
 * Build a page's complete `openGraph` object.
 *
 * Next.js REPLACES `openGraph` wholesale when a page declares one — it does
 * not merge field-by-field with the layout's. So every page that set its own
 * title/description/url silently dropped the layout's siteName, type, locale
 * and alternateLocale (found in the 2026-08-21 audit). Every call site must
 * go through here so those four are always present.
 */
export function ogFor(
  lang: string,
  {
    title,
    description,
    url,
    type = "website",
    publishedTime,
    images,
  }: {
    title: string;
    description: string;
    url: string;
    type?: "website" | "article";
    publishedTime?: string;
    images?: OgImages;
  }
): Metadata["openGraph"] {
  const base = {
    title,
    description,
    url,
    siteName: "RealData",
    locale: OG_LOCALE[lang] ?? OG_LOCALE.en,
    alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    ...(images ? { images } : {}),
  };
  return type === "article"
    ? { ...base, type: "article", publishedTime }
    : { ...base, type: "website" };
}

/** Schema.org BreadcrumbList for blog posts: Home → Blog → {post title}. */
export function blogBreadcrumbs(lang: string, slug: string, title: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "RealData", item: `${SITE_URL}/${lang}` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/${lang}/blog` },
      { "@type": "ListItem", position: 3, name: title, item: `${SITE_URL}/${lang}/blog/${slug}` },
    ],
  };
}

