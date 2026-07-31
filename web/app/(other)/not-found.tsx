import { NotFoundContent } from "@/components/NotFoundContent";

// Some Next.js/Vercel ISR fallback paths (see condo/[slug], district/[slug])
// still ship this boundary with HTTP 200 instead of 404 — a long-standing
// App Router limitation with dynamicParams=true + revalidate that we can't
// fully close without regressing those pages' caching. noindex is the
// backstop: it's honored on any 2xx/4xx response, so a mis-statused
// not-found page still never gets indexed as thin/duplicate content.
export const metadata = {
  title: "Not found — RealData",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundContent />;
}
