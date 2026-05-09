import { LANGS } from "@/lib/i18n";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://passionaryestate.com";

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

