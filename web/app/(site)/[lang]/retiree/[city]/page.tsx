// web/app/[lang]/retiree/[city]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadCaptureCTA } from "@/components/LeadCaptureCTA";
import { canonicalCitySlug, CITIES, cityProvinceSlugs, districtDisplayName, getCity, provinceDisplayName } from "@/lib/cities";
import { fmtTHB } from "@/lib/fmt";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { langAlternates, ogFor, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";
import { jsonLdString } from "@/lib/seo/safeJsonLd";

// Was 86400 — every city is prebuilt at build time (generateStaticParams
// below), so this only controls background ISR regen frequency. Underlying
// data (retiree_score, yields, livability) only changes on the weekly
// refresh.
export const revalidate = 604800;

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

type Row = {
  id: string;
  slug: string | null;
  name: string;
  province: string | null;
  retiree_score: number | null;
  gross_yield_pct: number | null;
  avg_sale_price: number | null;
  foreign_quota_inventory_pct: number | null;
  cam_fee_per_month: number | null;
  regions: { name: string } | { name: string }[] | null;
  livability_metrics:
    | { hospitals_within_1km: number }
    | { hospitals_within_1km: number }[]
    | null;
};

function regionLabel(r: Row): string {
  const region = Array.isArray(r.regions) ? r.regions[0] : r.regions;
  return districtDisplayName(region?.name) || provinceDisplayName(r.province);
}

function lm(r: Row): { hospitals_within_1km: number } | null {
  if (!r.livability_metrics) return null;
  return Array.isArray(r.livability_metrics)
    ? r.livability_metrics[0] ?? null
    : r.livability_metrics;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; lang: string }>;
}): Promise<Metadata> {
  const { city, lang } = await params;
  const cityObj = getCity(city);
  if (!cityObj || !isLang(lang)) return { title: "Retiree-Friendly Condos" };

  // Canonicalize alias URLs (e.g. "chon-buri") to the UI slug so we don't
  // publish a distinct canonical per DB province spelling.
  const canonical = canonicalCitySlug(city);
  const cityName = cityObj.name.en;
  const title = `Best Condos for Retirees in ${cityName} — Hospitals, AQI & Transit Ranked | RealData`;
  const description =
    `${cityName} condos ranked by retiree suitability score — ` +
    `hospitals within 1 km, air quality (AQI/PM2.5), BTS/MRT transit access, and daily errands. ` +
    `Includes foreign-quota availability and monthly CAM fees. No developer sponsorships.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/retiree/${canonical}`,
      languages: langAlternates(`/retiree/${canonical}`),
    },
    openGraph: { title, description, url: `${SEO_SITE_URL}/${lang}/retiree/${canonical}`, type: "website" },
  };
}

export default async function RetireeCityPage({
  params,
}: {
  params: Promise<{ city: string; lang: string }>;
}) {
  const { city, lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang).retireeTable;
  const cityObj = getCity(city);
  if (!cityObj) notFound();

  // Canonicalize the raw URL param — the DB `province` column has two slug
  // conventions (e.g. "chonburi" and "chon-buri"), and a link built off
  // either alias should resolve to the same city.
  const canonical = canonicalCitySlug(city);

  const supabase = getServerSupabase();
  const provinces = cityProvinceSlugs(canonical);

  const { data, error } = await supabase
    .from("condos_published")
    .select(
      "id, slug, name, province, retiree_score, gross_yield_pct, avg_sale_price, " +
        "foreign_quota_inventory_pct, cam_fee_per_month, regions(name), " +
        "livability_metrics(hospitals_within_1km)"
    )
    .gte("retiree_score", 55)
    .in("province", provinces)
    .order("retiree_score", { ascending: false })
    .limit(200);

  if (error) console.error("[retiree/city] Supabase error:", error);

  // Slugless rows are dropped, never linked by id. `/condo/<uuid>` does
  // resolve, but only as a meta-refresh hop to the slug URL (ISR can't
  // emit a real 308), which Google files under "Page with redirect" —
  // 4,136 of them by 2026-08-17, all crawl budget spent on nothing. The
  // ingest path leaves condos.slug null; scripts/backfill_condo_slug.py
  // fills it on the weekly refresh, so a brand-new building is invisible
  // here for at most one cycle instead of minting a redirect URL.
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.slug);

  // Fewer than 3 condos = not enough content to index.
  if (rows.length < 3) notFound();

  // Stats — computed from returned rows (no second query needed).
  const quotaRows = rows.filter((r) => r.foreign_quota_inventory_pct != null);
  const avgQuota =
    quotaRows.length > 0
      ? quotaRows.reduce((s, r) => s + r.foreign_quota_inventory_pct!, 0) /
        quotaRows.length
      : null;

  const nearHospital = rows.filter(
    (r) => (lm(r)?.hospitals_within_1km ?? 0) >= 1
  ).length;

  const camRows = rows
    .map((r) => r.cam_fee_per_month)
    .filter((v): v is number => v != null);
  const medianCam = median(camRows);

  const cityName = cityObj.name.en;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Retiree-Friendly Condos in ${cityName}`,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 20).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.name,
      url: `${SEO_SITE_URL}/${lang}/condo/${r.slug}`,
      additionalProperty: [
        { "@type": "PropertyValue", name: "Retiree Score", value: r.retiree_score ?? 0 },
        ...(r.foreign_quota_inventory_pct != null
          ? [{ "@type": "PropertyValue", name: "Foreign Quota (%)", value: r.foreign_quota_inventory_pct }]
          : []),
      ],
    })),
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />

      <header className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wider">
          RealData · Retiree lens
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Retiree-Friendly Condos in {cityName}
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
          Ranked by RealData&apos;s Retiree Suitability Score — weighted 40%
          healthcare proximity, 25% air quality, 20% transit access, 15% daily
          errands. Only buildings scoring ≥ 55 (Good+) are shown.
        </p>
      </header>

      {/* Stats block */}
      <section className="grid grid-cols-3 gap-3">
        <Stat
          label="Avg foreign quota"
          value={avgQuota != null ? `${avgQuota.toFixed(0)}%` : "—"}
        />
        <Stat
          label="Near a hospital"
          value={`${nearHospital} / ${rows.length}`}
        />
        <Stat
          label="Median CAM fee"
          value={medianCam != null ? `${fmtTHB(medianCam)}/mo` : "—"}
        />
      </section>

      {/* Listing table */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <table className="w-full text-sm hidden sm:table">
          <thead className="text-xs uppercase tracking-wider text-zinc-500 bg-zinc-900 border-b border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 w-10">{t.rank}</th>
              <th className="text-left px-4 py-3">{t.condo}</th>
              <th className="text-left px-4 py-3">{t.district}</th>
              <th className="text-right px-4 py-3">{t.score}</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">{t.fq}</th>
              <th className="text-right px-4 py-3">{t.sale}</th>
              <th className="text-right px-4 py-3 hidden md:table-cell">{t.yield}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="px-4 py-3 text-zinc-500 tabular-nums">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/${lang}/condo/${r.slug}`}
                    className="text-zinc-100 hover:underline font-medium"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400 capitalize">
                  {regionLabel(r)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-400">
                  {r.retiree_score?.toFixed(0) ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-500 hidden md:table-cell">
                  {r.foreign_quota_inventory_pct != null
                    ? `${r.foreign_quota_inventory_pct.toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmtTHB(r.avg_sale_price)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                  {r.gross_yield_pct != null ? `${r.gross_yield_pct.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <ul className="sm:hidden divide-y divide-zinc-800/70">
          {rows.map((r, i) => (
            <li key={r.id} className="p-3">
              <Link href={`/${lang}/condo/${r.slug}`} className="block space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-600 tabular-nums text-xs w-6 shrink-0">{i + 1}</span>
                  <span className="text-zinc-100 font-medium leading-snug">{r.name}</span>
                </div>
                <div className="flex items-baseline gap-3 pl-8 flex-wrap text-xs">
                  <span className="text-zinc-400 capitalize">{regionLabel(r)}</span>
                  <span className="font-semibold tabular-nums text-emerald-400 text-base">
                    {r.retiree_score?.toFixed(0) ?? "—"}
                  </span>
                </div>
                <div className="flex gap-3 pl-8 text-xs text-zinc-500 tabular-nums">
                  <span>{t.sale} {fmtTHB(r.avg_sale_price)}</span>
                  {r.foreign_quota_inventory_pct != null && (
                    <span>· {t.fq} {r.foreign_quota_inventory_pct.toFixed(0)}%</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
        <p>
          Retiree Suitability Score weights: healthcare proximity 40%, air
          quality (WAQI AQI) 25%, nearest BTS/MRT 20%, supermarkets within 1km
          15%. Score ≥ 75 = Excellent, ≥ 55 = Good, ≥ 35 = Fair. FQ % =
          foreign-quota inventory share of currently listed units.
        </p>
      </section>

      {/* Internal links to other cities */}
      <LeadCaptureCTA
        headline="Planning a retirement move to Thailand? Get a personalised shortlist."
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zinc-200">
          Same lens in other cities
        </h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {CITIES.filter((c) => c.slug !== canonical).map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/retiree/${c.slug}`}
              className="bg-zinc-900 border border-zinc-800 rounded-full px-3.5 py-2 text-zinc-300 hover:text-emerald-400 hover:border-zinc-600 transition"
            >
              {c.name.en}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl sm:text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
