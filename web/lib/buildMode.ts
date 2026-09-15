/**
 * True inside the Cloudflare condo export build (scripts/condo_static/).
 *
 * That build exists only to render /<lang>/condo/<slug> to static HTML, which
 * Cloudflare Workers then serves for free. Every other route's
 * generateStaticParams returns [] under it so the export does not also
 * prerender ~2,000 hub pages it will throw away -- each of those is Supabase
 * egress for nothing.
 */
export const CONDO_STATIC_BUILD = process.env.CONDO_STATIC_BUILD === "1";
