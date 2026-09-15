import { NotFoundContent } from "@/components/NotFoundContent";

// This boundary used to ship with HTTP 200 on every on-demand ISR path
// (condo/[slug], district/[slug], ...), which Search Console counted as
// 102 soft 404s. The cause was not ISR: it was (site)/[lang]/loading.tsx.
// A loading.tsx wraps the page in a Suspense boundary, so the 200 shell is
// committed before the page body gets to call notFound(). Deleted
// 2026-09-15; verified with a prerender of a nonexistent slug, whose .meta
// went from no status to "status": 404. Do not add a loading.tsx at or
// above a route that can 404.
//
// noindex stays as a backstop for any path that still streams.
export const metadata = {
  title: "Not found — RealData",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundContent />;
}
