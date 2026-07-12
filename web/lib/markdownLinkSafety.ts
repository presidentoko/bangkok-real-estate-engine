// Shared by the two tiny markdown-link-to-HTML renderers (AskChat.tsx and
// blog/weekly/[slug]/page.tsx). Both turn `[text](url)` into an `<a>` tag
// via a raw string replace + dangerouslySetInnerHTML, which is only safe
// if the href is quote-escaped and scheme-restricted:
//  - Claude's answers (AskChat) and generated post content (weekly blog)
//    are not fully trusted input — a crafted `[x](url"onmouseover=...)` or
//    a `javascript:`/`data:` href could otherwise inject an attribute or
//    an executable pseudo-scheme.
// Only http(s) and site-relative paths are allowed as real links; anything
// else is rendered as plain (already-escaped) text instead.
const SAFE_URL_RE = /^(https?:\/\/|\/)/i;

export function isSafeMarkdownUrl(url: string): boolean {
  return SAFE_URL_RE.test(url);
}

export function escapeHrefAttr(url: string): string {
  return url.replace(/"/g, "&quot;");
}

/**
 * Render a single already-escaped `[text](url)` match as an `<a>` tag, or
 * fall back to plain text when the URL scheme isn't allow-listed.
 */
export function renderMarkdownLink(text: string, url: string, linkClass: string): string {
  if (!isSafeMarkdownUrl(url)) return text;
  return `<a href="${escapeHrefAttr(url)}" class="${linkClass}">${text}</a>`;
}
