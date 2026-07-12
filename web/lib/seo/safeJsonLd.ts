/**
 * Safe serializer for JSON-LD `<script type="application/ld+json">` blocks.
 *
 * `JSON.stringify` alone is not safe to drop into `dangerouslySetInnerHTML`
 * for a <script> tag: a string value containing "</script>" (e.g. a scraped
 * condo name or description) would close the script element early and let
 * the remaining text be parsed as HTML — a stored-XSS vector. Escaping "<"
 * as the JSON-safe "<" neutralizes "</script>" (and "<!--") without
 * changing the parsed JSON value.
 */
export function jsonLdString(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
