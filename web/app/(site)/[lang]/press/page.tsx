import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Press kit — RealData" };
  const t = getDictionary(lang).press;
  return {
    title: `${t.title} — RealData`,
    description: t.lead,
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

  const supabase = getServerSupabase();
  const [bldgs, listings] = await Promise.all([
    supabase.from("condos_published").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-8">
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{t.title}</h1>
        <p className="text-zinc-400 mt-3 text-base sm:text-lg max-w-2xl leading-relaxed">
          {t.lead}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.statsHeader}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-3xl font-black tabular-nums">
              {(bldgs.count ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">buildings</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-3xl font-black tabular-nums">
              {(listings.count ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">active listings</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-3xl font-black tabular-nums">9</div>
            <div className="text-xs text-zinc-500 mt-1">cities</div>
          </div>
        </div>
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
              <dd className="text-zinc-100 text-sm font-semibold text-right">{it.v}</dd>
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
