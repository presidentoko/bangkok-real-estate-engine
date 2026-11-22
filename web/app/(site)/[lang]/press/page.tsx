import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { CITIES } from "@/lib/cities";
import { fetchSiteStats } from "@/lib/queries/condos";
import { TEN_NUMBERS, TEN_NUMBERS_PATH } from "@/lib/tenNumbers";

export const revalidate = 86400;

/** "{condos}" in the press copy -> the live published condo-page count, the
 *  same figure as the home page. It was a hand-written "1,800+" two lines
 *  from a live "15,645" (data audit M2). */
async function fillCounts(): Promise<(s: string) => string> {
  const stats = await fetchSiteStats().catch(() => null);
  const n = stats?.totalCondos ? stats.totalCondos.toLocaleString("en-US") : null;
  return (s: string) => (n ? s.replaceAll("{condos}", n) : s.replaceAll("{condos} ", "").replaceAll("{condos}", "—"));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Press kit — RealData" };
  const t = getDictionary(lang).press;
  const fill = await fillCounts();
  return {
    title: `${t.title} — RealData`,
    description: fill(t.lead),
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/press`,
      languages: langAlternates("/press"),
    },
  };
}

export default async function PressPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang).press;

  const [stats, fill] = await Promise.all([fetchSiteStats().catch(() => null), fillCounts()]);
  const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));

  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-8">
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{t.title}</h1>
        <p className="text-zinc-400 mt-3 text-base sm:text-lg max-w-2xl leading-relaxed">
          {fill(t.lead)}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.statsHeader}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-3xl font-black tabular-nums">
              {fmt(stats?.totalCondos)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">condo pages</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-3xl font-black tabular-nums">
              {fmt(stats?.totalListings)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">active listings</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-3xl font-black tabular-nums">{CITIES.length}</div>
            <div className="text-xs text-zinc-500 mt-1">cities</div>
          </div>
        </div>
        <Link
          href={`/${lang}${TEN_NUMBERS_PATH}`}
          className="inline-block mt-4 text-sm text-blue-300 hover:underline"
        >
          {TEN_NUMBERS[lang].inboundLink} →
        </Link>
      </section>

      {t.sections.map((s) => (
        <section key={s.title} className="mb-8">
          <h2 className="text-xl font-bold mb-3">{s.title}</h2>
          <p className="text-zinc-300 leading-relaxed">{s.body}</p>
        </section>
      ))}

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">Factsheet</h2>
        <dl className="space-y-2">
          {t.factsheet.map((it) => (
            <div
              key={it.k}
              className="flex justify-between gap-3 py-2 border-b border-zinc-900"
            >
              <dt className="text-zinc-400 text-sm">{it.k}</dt>
              <dd className="text-zinc-100 text-sm font-semibold text-right">{fill(it.v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-10 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-2">
          {t.contactsHeader}
        </h2>
        <p className="text-zinc-300 text-sm leading-relaxed">{t.contactsBody}</p>
        <Link
          href={`/${lang}/contact`}
          className="inline-block mt-4 bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-400 transition"
        >
          Contact form →
        </Link>
      </section>
    </main>
  );
}
