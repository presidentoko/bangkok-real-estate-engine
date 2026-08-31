import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { fmtTHB } from "@/lib/fmt";
import {
  FLOOD_DISTRICTS,
  findFloodDistrict,
  floodRank,
  type FloodDistrict,
} from "@/lib/floodDistricts";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, LANGS, type Lang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";
import { getServerSupabase } from "@/lib/supabase";

/* Per-khet flood answer pages.
 *
 *  Why these exist: /flood scored all 50 districts on ONE URL, so the whole
 *  flood product could only compete for one query ("Bangkok flood risk map").
 *  Nobody types that. They type "does Lat Krabang flood", "อโศก น้ำท่วมไหม",
 *  "방콕 라차테위 침수" — 50 distinct questions we had no page for, which is
 *  why a car-rental blog outranked us for Bangkok flood areas in Aug 2026.
 *  One page per khet x 3 locales = 150 URLs, each answering one question in
 *  its title.
 *
 *  Deliberately NOT a copy of /district/<slug>: that page is the building
 *  inventory with yields and prices and mentions flood in passing; this one
 *  is the flood verdict, the 2011 history, the rank among 50, and the
 *  cross-links — and it hands the reader to the district page for inventory.
 *
 *  Levels come from the committed lib/floodDistricts.ts table rather than
 *  the 334KB GeoJSON, so rendering costs one Supabase count + one condo
 *  query and no file parse. */

// Flood levels move once a year (after the BMA monsoon report); the condo
// counts move on the weekly scraper refresh. Weekly ISR is the faster of
// the two — matching district/[slug] and condo/[slug], and keeping these
// 150 URLs off the ISR-write budget that Vercel Hobby bills as Fast Origin
// Transfer.
export const revalidate = 604800;

/** Prebuild all 50 x 3. They are static apart from the condo list, so this
 *  costs 150 cheap renders at build and removes every cold-start miss for
 *  the crawler that finds them through the /flood table. */
export function generateStaticParams() {
  return FLOOD_DISTRICTS.flatMap((d) =>
    LANGS.map((lang) => ({ lang, district: d.slug })),
  );
}

/** The name to print. Thai readers get the Thai khet name from the BMA
 *  layer; en/ko get the romanised one — Korean has no settled
 *  transliteration for most khet, and Korean searchers type the romanised
 *  form. */
function displayName(d: FloodDistrict, lang: Lang): string {
  return lang === "th" && d.nameTh ? d.nameTh : d.name;
}

/** Published, active buildings in this khet, plus the total count.
 *
 *  Same published+is_active bar as district/[slug]: an unpublished condo's
 *  detail route renders the not-found boundary, so linking one from here
 *  would be a dead link on a page whose whole job is to be trusted.
 *  cache()'d because generateMetadata needs the count for the description
 *  before the body runs the same query. */
const getCondos = cache(async (slug: string) => {
  const supabase = getServerSupabase();
  const { data: region } = await supabase
    .from("regions")
    .select("id")
    .eq("name", slug)
    .limit(1)
    .maybeSingle();
  const regionId = (region as { id: string } | null)?.id;
  if (!regionId) return { total: 0, rows: [] as CondoLite[] };

  const [{ count }, { data }] = await Promise.all([
    supabase
      .from("condos")
      .select("id", { count: "exact", head: true })
      .eq("region_id", regionId)
      .eq("is_active", true)
      .eq("published", true),
    supabase
      .from("condos")
      .select("id, slug, name, avg_sale_price, gross_yield_pct")
      .eq("region_id", regionId)
      .eq("is_active", true)
      .eq("published", true)
      .not("slug", "is", null)
      .order("avg_sale_price", { ascending: false, nullsFirst: false })
      .limit(CONDO_CAP),
  ]);

  return { total: count ?? 0, rows: (data ?? []) as CondoLite[] };
});

type CondoLite = {
  id: string;
  slug: string | null;
  name: string;
  avg_sale_price: number | null;
  gross_yield_pct: number | null;
};

/** Enough to prove the district is really covered, few enough that the page
 *  stays an answer rather than turning into another inventory dump — the
 *  mistake /flood and /city/bangkok both made. The district page one click
 *  away carries the full list. */
const CONDO_CAP = 24;

function resolveOrNotFound(raw: string): FloodDistrict {
  const d = findFloodDistrict(raw);
  if (!d) notFound();
  return d;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; district: string }>;
}): Promise<Metadata> {
  const { lang, district } = await params;
  const d = resolveOrNotFound(district);
  const safeLang: Lang = isLang(lang) ? lang : "en";
  const t = getDictionary(safeLang);
  const name = displayName(d, safeLang);
  const { total } = await getCondos(d.slug);

  const title = t.seo.floodDistrictTitle(name, d.level);
  const description = t.seo.floodDistrictDesc(name, d.level, total);
  const path = `/flood/${d.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${safeLang}${path}`,
      languages: langAlternates(path),
    },
    openGraph: ogFor(safeLang, {
      title,
      description,
      url: `${SEO_SITE_URL}/${safeLang}${path}`,
    }),
  };
}

const LEVEL_TONE: Record<number, string> = {
  0: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  1: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  2: "bg-lime-500/10 text-lime-300 border-lime-500/30",
  3: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  4: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  5: "bg-red-500/10 text-red-300 border-red-500/30",
};

export default async function FloodDistrictPage({
  params,
}: {
  params: Promise<{ lang: string; district: string }>;
}) {
  const { lang, district } = await params;
  if (!isLang(lang)) notFound();
  const d = resolveOrNotFound(district);

  const dict = getDictionary(lang);
  const t = dict.floodDistrict;
  const name = displayName(d, lang);
  const { total, rows } = await getCondos(d.slug);
  const rank = floodRank(d.slug);

  // FLOOD_DISTRICTS is ordered riskiest-first, so "wetter" is everything
  // before this district and "drier" everything after. Take the nearest few
  // on each side: the useful comparison for someone deciding between two
  // areas is the neighbour on the scale, not the extreme.
  const idx = rank - 1;
  const wetter = FLOOD_DISTRICTS.slice(Math.max(0, idx - 4), idx).filter(
    (x) => x.level > d.level,
  );
  const drier = FLOOD_DISTRICTS.slice(idx + 1, idx + 5).filter((x) => x.level < d.level);
  const same = FLOOD_DISTRICTS.filter((x) => x.level === d.level && x.slug !== d.slug).slice(0, 8);

  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.nav.flood, href: `/${lang}/flood` },
    { name, href: `/${lang}/flood/${d.slug}` },
  ];

  const faqItems = [
    { q: t.faq.q1(name), a: t.verdict[d.level](name) },
    { q: t.faq.q2(name), a: d.level >= 4 ? t.faq.a2high(name) : t.faq.a2low(name) },
    { q: t.faq.q3(name), a: t.faq.a3(name) },
  ];

  const tone = LEVEL_TONE[d.level] ?? LEVEL_TONE[3];

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(buildFaqJsonLd(faqItems)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            buildBreadcrumbsJsonLd(
              crumbs.map((c) => ({ name: c.name, url: `${SEO_SITE_URL}${c.href}` })),
            ),
          ),
        }}
      />

      <header className="space-y-3">
        <Breadcrumbs items={crumbs} />
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          {t.eyebrow}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          {t.h1(name, d.level)}
        </h1>
        {/* Romanisation is not settled for most khet, and a reader who
            arrived searching one spelling needs to see the others to trust
            they are on the right page. Also the honest place to disclose
            that we print Watthana/Sathorn where the map layer says
            Vadhana/Sathon. */}
        {lang !== "th" && d.aka.length > 0 && (
          <p className="text-xs text-zinc-500">{t.altSpelling(d.aka.join(", "))}</p>
        )}
      </header>

      {/* The verdict — the whole reason someone opened this page. */}
      <section className={`rounded-2xl border p-5 sm:p-6 space-y-3 ${tone}`}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-black">L{d.level}</span>
          <span className="text-sm font-semibold opacity-90">
            {dict.floodLegend.descriptors[d.level]}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-zinc-200">{t.verdict[d.level](name)}</p>
        <p className="text-xs text-zinc-400">{t.rankLine(rank, FLOOD_DISTRICTS.length)}</p>
      </section>

      {/* Buildings we actually measure here — proof the score is not abstract. */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t.trackedTitle(name)}</h2>
        {total > 0 ? (
          <>
            <p className="text-sm text-zinc-400 leading-relaxed">{t.trackedNote(total, name)}</p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {rows.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/${lang}/condo/${c.slug}`}
                    className="text-zinc-300 hover:text-emerald-400 hover:underline truncate"
                  >
                    {c.name}
                  </Link>
                  <span className="text-zinc-500 text-xs shrink-0 tabular-nums">
                    {c.avg_sale_price != null ? fmtTHB(c.avg_sale_price) : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}/district/${d.slug}`}
              className="inline-block text-sm text-emerald-400 hover:underline"
            >
              {t.seeAllInDistrict(name)} →
            </Link>
          </>
        ) : (
          <p className="text-sm text-zinc-400">{t.trackedNone(name)}</p>
        )}
      </section>

      {/* Lateral crawl path: 50 flood pages linking to each other by rank. */}
      <section className="space-y-4">
        {wetter.length > 0 && <DistrictChips lang={lang} title={t.riskierTitle} items={wetter} />}
        {same.length > 0 && (
          <DistrictChips lang={lang} title={t.sameTitle(d.level)} items={same} />
        )}
        {drier.length > 0 && <DistrictChips lang={lang} title={t.saferTitle} items={drier} />}
        <Link
          href={`/${lang}/flood`}
          className="inline-block text-sm text-emerald-400 hover:underline"
        >
          {t.allTitle} →
        </Link>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-200">{t.methodTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.methodBody}</p>
      </section>

      <FaqSection items={faqItems} heading={t.faqTitle(name)} />

      <LeadCaptureCTA lang={lang} />
    </main>
  );
}

function DistrictChips({
  lang,
  title,
  items,
}: {
  lang: Lang;
  title: string;
  items: FloodDistrict[];
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{title}</div>
      <ul className="flex flex-wrap gap-2">
        {items.map((x) => (
          <li key={x.slug}>
            <Link
              href={`/${lang}/flood/${x.slug}`}
              className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              {displayName(x, lang)}
              <span className="text-zinc-500"> · L{x.level}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
