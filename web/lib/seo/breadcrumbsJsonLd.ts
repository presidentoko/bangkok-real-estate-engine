// web/lib/seo/breadcrumbsJsonLd.ts
// Generic BreadcrumbList JSON-LD. The condo-specific builder in condoJsonLd.ts
// stays as-is; this one serves hubs, station spokes, and the glossary.

export type Crumb = { name: string; url: string };

export function buildBreadcrumbsJsonLd(items: Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}
