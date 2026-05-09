import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Methodology — RealData" };
  const t = getDictionary(lang).about;
  return {
    title: `${t.title} — RealData`,
    description: t.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/about`,
      languages: langAlternates("/about"),
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang).about;

  // FAQ JSON-LD: each Q+A becomes a citable entity for AI Overviews.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: t.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // BreadcrumbList: Home → Methodology
  const breadcrumbsJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "RealData", item: `${SEO_SITE_URL}/${lang}` },
      { "@type": "ListItem", position: 2, name: t.title, item: `${SEO_SITE_URL}/${lang}/about` },
    ],
  };

  return (
    <main className="max-w-3xl mx-auto p-6 sm:p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />

      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{t.title}</h1>
        <p className="text-zinc-400 mt-3 text-base sm:text-lg max-w-2xl leading-relaxed">
          {t.lead}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">{t.sectionMission.title}</h2>
        <p className="text-zinc-300 leading-relaxed">{t.sectionMission.body}</p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">{t.sectionSources.title}</h2>
        <dl className="space-y-3">
          {t.sectionSources.items.map((it) => (
            <div
              key={it.k}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <dt className="font-semibold text-zinc-100 text-sm">{it.k}</dt>
              <dd className="text-zinc-400 text-sm mt-1 leading-relaxed">{it.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">{t.sectionFormulas.title}</h2>
        <dl className="space-y-3">
          {t.sectionFormulas.items.map((it) => (
            <div
              key={it.k}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <dt className="font-semibold text-blue-300 text-sm">{it.k}</dt>
              <dd className="text-zinc-400 text-sm mt-1 leading-relaxed font-mono">
                {it.v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">{t.sectionWhatWeDont.title}</h2>
        <ul className="space-y-2 text-zinc-300 text-sm leading-relaxed">
          {t.sectionWhatWeDont.items.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-rose-400 shrink-0">✗</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">{t.sectionRefresh.title}</h2>
        <dl className="grid sm:grid-cols-3 gap-3">
          {t.sectionRefresh.items.map((it) => (
            <div
              key={it.k}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <dt className="font-semibold text-zinc-100 text-xs uppercase tracking-wider">
                {it.k}
              </dt>
              <dd className="text-zinc-400 text-sm mt-1.5">{it.v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-zinc-500 text-xs mt-3 italic">
          {t.sectionRefresh.footer}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold mb-3">{t.sectionLimits.title}</h2>
        <ul className="space-y-2 text-zinc-300 text-sm leading-relaxed">
          {t.sectionLimits.items.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-amber-400 shrink-0">!</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 pt-6 border-t border-zinc-900">
        <h2 className="text-xl font-bold mb-4">FAQ</h2>
        <div className="space-y-3">
          {t.faq.map((f, i) => (
            <details
              key={i}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 [&_summary]:cursor-pointer"
            >
              <summary className="font-semibold list-none flex items-baseline justify-between gap-3">
                <span>{f.q}</span>
                <span className="text-zinc-500 group-open:rotate-180 transition shrink-0">
                  ▾
                </span>
              </summary>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
