// web/lib/seo/definedTermJsonLd.ts
// DefinedTerm (single glossary entry) + DefinedTermSet (the glossary as a whole).
// Used for AEO definition-query eligibility.

export type DefinedTermInput = {
  term: string;
  definition: string;
  url: string;
  inSetUrl: string; // URL of the glossary index (the DefinedTermSet)
};

export function buildDefinedTermJsonLd(t: DefinedTermInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    url: t.url,
    inDefinedTermSet: t.inSetUrl,
  };
}

export function buildDefinedTermSetJsonLd(args: {
  name: string;
  url: string;
  terms: Array<{ term: string; url: string }>;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: args.name,
    url: args.url,
    hasDefinedTerm: args.terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      url: t.url,
    })),
  };
}
