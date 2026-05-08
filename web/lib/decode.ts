// hipflat occasionally serves text with HTML entities (`&#39;`, `&amp;`, etc)
// embedded inside JSON-LD strings — those don't get decoded by JSON.parse,
// so we strip them here at display time. Numeric entities + the common
// named ones cover everything we've actually seen on the site.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

export function decodeEntities(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}
