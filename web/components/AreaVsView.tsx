import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import FaqSection from "@/components/FaqSection";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { districtDisplayName } from "@/lib/cities";
import {
  COMPARE_PAIRS,
  findComparePair,
  stationDisplayName,
  type ComparePair,
} from "@/lib/comparePairs";
import { findFloodDistrict } from "@/lib/floodDistricts";
import { fmtTHB } from "@/lib/fmt";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, type Lang } from "@/lib/i18n";
import { getComparison, type CompareSide } from "@/lib/queries/areaCompare";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbsJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/faqJsonLd";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

/* One area against another. See lib/comparePairs.ts for why this route
 * exists and how the pairs were chosen. */

const pct = (n: number | null) => (n == null ? "—" : n.toFixed(1));

export function sideName(pair: ComparePair, key: string, lang: Lang): string {
  if (pair.kind === "station") return stationDisplayName(key);
  if (lang === "th") {
    const bma = findFloodDistrict(key);
    if (bma?.nameTh) return bma.nameTh;
  }
  return districtDisplayName(key);
}

async function resolve(slug: string) {
  const pair = findComparePair(slug);
  if (!pair) notFound();
  const data = await getComparison(pair);
  if (!data) notFound();
  return { pair, ...data };
}

export async function areaVsMetadata(rawLang: string, slug: string): Promise<Metadata> {
  const lang: Lang = isLang(rawLang) ? rawLang : "en";
  const { pair, a, b } = await resolve(slug);
  const t = getDictionary(lang).areaVs;
  const [an, bn] = [sideName(pair, a.key, lang), sideName(pair, b.key, lang)];
  const title = t.metaTitle(an, bn, new Date().getFullYear());
  const description = t.desc(an, bn, a.condos + b.condos);
  const path = `/vs/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: `${SEO_SITE_URL}/${lang}${path}`, languages: langAlternates(path) },
    openGraph: ogFor(lang, { title, description, url: `${SEO_SITE_URL}/${lang}${path}`, type: "article" }),
  };
}

export async function AreaVsView({ lang: rawLang, slug }: { lang: string; slug: string }) {
  if (!isLang(rawLang)) notFound();
  const lang: Lang = rawLang;
  const { pair, a, b } = await resolve(slug);
  const dict = getDictionary(lang);
  const t = dict.areaVs;
  const an = sideName(pair, a.key, lang);
  const bn = sideName(pair, b.key, lang);

  // The verdict lines. Each one is only claimed where both sides have the
  // number behind it.
  const lines: string[] = [];
  let cheaper = an;
  if (a.medianSale != null && b.medianSale != null) {
    const [lo, hi] = a.medianSale <= b.medianSale ? [a, b] : [b, a];
    const [loN, hiN] = lo === a ? [an, bn] : [bn, an];
    const gap = ((hi.medianSale! - lo.medianSale!) / hi.medianSale!) * 100;
    cheaper = loN;
    lines.push(gap < 5 ? t.samePrice(an, bn) : t.cheaper(loN, gap.toFixed(0), hiN));
  }
  let yieldy = an;
  if (a.medianYieldPct != null && b.medianYieldPct != null) {
    const [hi, lo] = a.medianYieldPct >= b.medianYieldPct ? [a, b] : [b, a];
    const [hiN, loN] = hi === a ? [an, bn] : [bn, an];
    yieldy = hiN;
    lines.push(t.yields(hiN, pct(hi.medianYieldPct), loN, pct(lo.medianYieldPct)));
  } else if (a.medianYieldPct != null) {
    lines.push(t.yieldsOne(an, pct(a.medianYieldPct)));
  } else if (b.medianYieldPct != null) {
    lines.push(t.yieldsOne(bn, pct(b.medianYieldPct)));
  }
  if (a.floodLevel != null && b.floodLevel != null) {
    lines.push(
      a.floodLevel === b.floodLevel
        ? t.floodSame(a.floodLevel)
        : a.floodLevel < b.floodLevel
          ? t.floodLine(an, a.floodLevel, bn, b.floodLevel)
          : t.floodLine(bn, b.floodLevel, an, a.floodLevel),
    );
  }

  const faqItems = [
    {
      q: t.faq.q1(an, bn),
      a:
        a.medianSale != null && b.medianSale != null
          ? `${lines[0]} ${an}: ${fmtTHB(a.medianSale)}. ${bn}: ${fmtTHB(b.medianSale)}.`
          : t.samePrice(an, bn),
    },
    {
      q: t.faq.q2(an, bn),
      a:
        a.medianYieldPct != null && b.medianYieldPct != null
          ? t.yields(
              a.medianYieldPct >= b.medianYieldPct ? an : bn,
              pct(Math.max(a.medianYieldPct, b.medianYieldPct)),
              a.medianYieldPct >= b.medianYieldPct ? bn : an,
              pct(Math.min(a.medianYieldPct, b.medianYieldPct)),
            )
          : a.medianYieldPct != null
            ? t.yieldsOne(an, pct(a.medianYieldPct))
            : b.medianYieldPct != null
              ? t.yieldsOne(bn, pct(b.medianYieldPct))
              : t.methodBody,
    },
    {
      q: t.faq.q3(an, bn),
      a:
        a.floodLevel != null && b.floodLevel != null
          ? a.floodLevel === b.floodLevel
            ? t.floodSame(a.floodLevel)
            : a.floodLevel < b.floodLevel
              ? t.floodLine(an, a.floodLevel, bn, b.floodLevel)
              : t.floodLine(bn, b.floodLevel, an, a.floodLevel)
          : t.faq.a3none(an, bn),
    },
    { q: t.faq.q4, a: t.faq.a4(cheaper, yieldy) },
  ];

  const path = `/vs/${slug}`;
  const crumbs = [
    { name: "RealData", href: `/${lang}` },
    { name: dict.nav.yields, href: `/${lang}/yields` },
    { name: `${an} vs ${bn}`, href: `/${lang}${path}` },
  ];

  const others = COMPARE_PAIRS.filter((p) => p.slug !== slug).slice(0, 8);

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
            buildBreadcrumbsJsonLd(crumbs.map((c) => ({ name: c.name, url: `${SEO_SITE_URL}${c.href}` }))),
          ),
        }}
      />

      <header className="space-y-3">
        <Breadcrumbs items={crumbs} />
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t.eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{t.h1(an, bn)}</h1>
        {pair.kind === "station" && <p className="text-xs text-zinc-500">{t.stationNote}</p>}
      </header>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-100">{t.verdictTitle}</h2>
        {lines.map((l) => (
          <p key={l} className="text-sm leading-relaxed text-zinc-200">
            {l}
          </p>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t.tableTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-zinc-400 border-b border-zinc-800">
                <th className="py-2 pr-4"></th>
                <th className="py-2 pr-4">{an}</th>
                <th className="py-2 pr-4">{bn}</th>
              </tr>
            </thead>
            <tbody>
              <Row label={t.rowCondos} a={String(a.condos)} b={String(b.condos)} />
              <Row label={t.rowSale} a={fmtTHB(a.medianSale)} b={fmtTHB(b.medianSale)} />
              <Row
                label={t.rowYield}
                a={a.medianYieldPct != null ? `${pct(a.medianYieldPct)}%` : "—"}
                b={b.medianYieldPct != null ? `${pct(b.medianYieldPct)}%` : "—"}
                highlight
              />
              <Row
                label={t.rowFlood}
                a={a.floodLevel != null ? `${a.floodLevel}/5` : "—"}
                b={b.floodLevel != null ? `${b.floodLevel}/5` : "—"}
              />
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-6">
        {[
          { side: a, name: an },
          { side: b, name: bn },
        ].map(({ side, name }) => (
          <TopList key={side.key} lang={lang} name={name} side={side} t={t} />
        ))}
      </div>

      <section className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {pair.kind === "district" && pair.city && (
          <>
            <Link href={`/${lang}/yield/${pair.city}/${a.key}`} className="text-emerald-400 hover:underline">
              {t.seeArea(an)} →
            </Link>
            <Link href={`/${lang}/yield/${pair.city}/${b.key}`} className="text-emerald-400 hover:underline">
              {t.seeArea(bn)} →
            </Link>
          </>
        )}
        {pair.kind === "station" && (
          <>
            <Link href={`/${lang}/near/${a.key}`} className="text-emerald-400 hover:underline">
              {an} →
            </Link>
            <Link href={`/${lang}/near/${b.key}`} className="text-emerald-400 hover:underline">
              {bn} →
            </Link>
          </>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-200">{t.methodTitle}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">{t.methodBody}</p>
      </section>

      <FaqSection items={faqItems} heading={t.faqTitle(an, bn)} />

      <section>
        <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.otherTitle}</div>
        <ul className="flex flex-wrap gap-2">
          {others.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/${lang}/vs/${p.slug}`}
                className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
              >
                {sideName(p, p.a, lang)} vs {sideName(p, p.b, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <LeadCaptureCTA lang={lang} />
    </main>
  );
}

function Row({
  label,
  a,
  b,
  highlight,
}: {
  label: string;
  a: string;
  b: string;
  highlight?: boolean;
}) {
  const tone = highlight ? "text-emerald-400" : "text-zinc-300";
  return (
    <tr className="border-b border-zinc-900">
      <td className="py-2 pr-4 text-zinc-400">{label}</td>
      <td className={`py-2 pr-4 tabular-nums ${tone}`}>{a}</td>
      <td className={`py-2 pr-4 tabular-nums ${tone}`}>{b}</td>
    </tr>
  );
}

function TopList({
  lang,
  name,
  side,
  t,
}: {
  lang: Lang;
  name: string;
  side: CompareSide;
  t: ReturnType<typeof getDictionary>["areaVs"];
}) {
  if (side.top.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{t.topTitle(name)}</h2>
      <ul className="space-y-1.5 text-sm">
        {side.top.map((c) => (
          <li key={c.slug} className="flex items-baseline justify-between gap-3">
            <Link href={`/${lang}/condo/${c.slug}`} className="text-zinc-300 hover:text-emerald-400 hover:underline truncate">
              {c.name}
            </Link>
            <span className="text-zinc-500 text-xs shrink-0 tabular-nums">{fmtTHB(c.sale)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
