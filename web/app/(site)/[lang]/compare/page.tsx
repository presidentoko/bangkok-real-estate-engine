import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompareExplorer } from "@/components/CompareExplorer";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

// Static shell — no searchParams read here. Reading ?a/?b/?c server-side
// silently opted the whole route out of ISR (every shared comparison link
// became a live Function invocation + 4 Supabase queries), which was true
// for this page and 3 others before 2026-07-11. The default view (no ids)
// renders statically at build/regen time; CompareExplorer (client) reads
// ?a/?b/?c after hydration and fetches the comparison rows from
// /api/condos/compare when ids are present. See lib/compare.ts + that route.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Compare condos — RealData" };
  return {
    title: "Compare Bangkok condos side-by-side — RealData",
    description:
      "Compare 2-3 Bangkok condos head-to-head: yield, mortgage spread, " +
      "flood risk, transit distance, foreign quota, multi-portal price. " +
      "Independent measurement.",
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/compare`,
      languages: langAlternates("/compare"),
    },
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Compare condos</h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Head-to-head comparison of up to 3 Bangkok condos. Add condos by
          clicking <strong className="text-zinc-300">&quot;Compare with…&quot;</strong> on any
          condo page, or paste ids into the URL as{" "}
          <code className="text-zinc-300">?a=ID&amp;b=ID&amp;c=ID</code>.
        </p>
      </header>

      <CompareExplorer lang={lang} />

      <p className="text-xs text-zinc-500 leading-relaxed">
        ★ highlights the best value in each row. Yield + spread are pre-tax,
        pre-vacancy. Foreign quota share = % of currently-listed units tagged
        Foreign Quota on FazWaz; sold-quota status is not visible — confirm at
        the sales office.
      </p>
    </main>
  );
}
