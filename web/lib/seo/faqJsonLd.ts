/**
 * FAQPage JSON-LD builder.
 *
 * Drop one of these into a page to make its Q&A bullets eligible for
 * Google's FAQ-rich result, Perplexity citation, and ChatGPT/Claude
 * answer-engine quoting. Each FAQ item carries `acceptedAnswer` text
 * that should be quotable as-is (no marketing fluff, no broken refs).
 */

export type FaqItem = { q: string; a: string };

export function buildFaqJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
