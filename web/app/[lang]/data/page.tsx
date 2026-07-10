import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canonicalCitySlug, CITIES, cityProvinceSlugs } from "@/lib/cities";
import { getDictionary } from "@/lib/getDictionary";
import { isLang, type Lang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Data — RealData" };
  const t = getDictionary(lang).dataShowcase;
  return {
    title: `${t.title} — RealData`,
    description: t.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/data`,
      languages: langAlternates("/data"),
    },
  };
}

const PROVINCES: Array<{ slug: string; en: string; ko: string; th: string }> = [
  { slug: "bangkok", en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
  ...CITIES.map((c) => ({ slug: c.slug, en: c.name.en, ko: c.name.ko, th: c.name.th })),
];

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

type CityStat = {
  slug: string;
  name: string;
  buildings: number;
  scored: number;
  medianSale: number | null;
  medianBubble: number | null;
};

type TopCondo = {
  id: string;
  name: string;
  region: string | null;
  province: string;
  metric: number | null;
  isSuperValue?: boolean;
};

const HISTOGRAM_BUCKETS = [
  { lo: 0, hi: 50, color: "#10b981" },
  { lo: 51, hi: 90, color: "#84cc16" },
  { lo: 91, hi: 130, color: "#facc15" },
  { lo: 131, hi: 200, color: "#fb923c" },
  { lo: 201, hi: 500, color: "#f43f5e" },
  { lo: 501, hi: 9999, color: "#dc2626" },
];

export default async function DataShowcase({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang).dataShowcase;
  const supabase = getServerSupabase();

  // 1. Total counts
  const [
    buildingsTotal,
    listingsTotal,
    chartPointsTotal,
    regionsTotal,
  ] = await Promise.all([
    supabase.from("condos_published").select("id", { count: "exact", head: true }).eq("source", "hipflat"),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("condo_market_chart").select("id", { count: "exact", head: true }),
    supabase.from("regions").select("id", { count: "exact", head: true }),
  ]);

  // 2. Per-city stats
  const cityStats: CityStat[] = [];
  for (const p of PROVINCES) {
    const { data: condos, count: bcount } = await supabase
      .from("condos_published")
      .select("id, market_sale_median", { count: "exact" })
      .in("province", cityProvinceSlugs(canonicalCitySlug(p.slug)))
      .limit(2000);
    const ids = (condos ?? []).map((c) => (c as { id: string }).id);
    const sales = (condos ?? [])
      .map((c) => (c as { market_sale_median: number | null }).market_sale_median)
      .filter((v): v is number => v != null);

    let bubbles: number[] = [];
    let scored = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const r = await supabase
        .from("value_scores")
        .select("bubble_index")
        .in("condo_id", chunk);
      const vs = (r.data ?? [])
        .map((v) => (v as { bubble_index: number | null }).bubble_index)
        .filter((v): v is number => v != null);
      bubbles.push(...vs);
      scored += vs.length;
    }
    cityStats.push({
      slug: p.slug,
      name: p[lang as Lang] ?? p.en,
      buildings: bcount ?? 0,
      scored,
      medianSale: median(sales),
      medianBubble: median(bubbles),
    });
  }

  // 3. Bubble distribution histogram (across all)
  const histogram = HISTOGRAM_BUCKETS.map(() => 0);
  for (let i = 0; i < cityStats.length; i++) {
    // Re-pull all bubble_indexes — we already fetched them in the loop above,
    // but discarded them. Cheap to re-do for clarity.
  }
  // Actually compute histogram from a single broad pull
  const bubbleAll: number[] = [];
  let off = 0;
  while (true) {
    const { data } = await supabase
      .from("value_scores")
      .select("bubble_index")
      .range(off, off + 999);
    const rows = (data ?? []) as Array<{ bubble_index: number | null }>;
    if (!rows.length) break;
    for (const r of rows) {
      if (r.bubble_index != null) bubbleAll.push(r.bubble_index);
    }
    if (rows.length < 1000) break;
    off += 1000;
  }
  for (const b of bubbleAll) {
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
      const { lo, hi } = HISTOGRAM_BUCKETS[i];
      if (b >= lo && b <= hi) {
        histogram[i]++;
        break;
      }
    }
  }
  const histMax = Math.max(...histogram, 1);

  // 4. Top 10 most expensive — by sale per-sqm rather than sale median
  //    (the median field is capped at $671,360 in upstream Hipflat data,
  //    which makes the top 10 a single tied bucket with no signal).
  //    per-sqm gives a real spread; we de-dup by (name, region) so the
  //    same project doesn't take 5 of the 10 slots.
  const { data: expensiveData } = await supabase
    .from("condos_published")
    .select("id, name, regions(name), province, market_sale_per_sqm, market_sale_median")
    .not("market_sale_per_sqm", "is", null)
    .gt("market_sale_per_sqm", 0)
    .order("market_sale_per_sqm", { ascending: false })
    .limit(100);
  const seenName = new Set<string>();
  const topExpensive: TopCondo[] = ((expensiveData ?? []) as unknown as Array<{
    id: string;
    name: string;
    regions: { name: string } | { name: string }[] | null;
    province: string;
    market_sale_per_sqm: number | null;
    market_sale_median: number | null;
  }>)
    .map((c) => ({
      id: c.id,
      name: c.name,
      region: (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? null,
      province: c.province,
      metric: c.market_sale_per_sqm,
    }))
    .filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seenName.has(key)) return false;
      seenName.add(key);
      return true;
    })
    .slice(0, 10);

  // 5. Top 10 Super Value
  const { data: svData } = await supabase
    .from("value_scores")
    .select("condo_id, bubble_index, asset_value_score")
    .eq("is_super_value", true)
    .order("asset_value_score", { ascending: false })
    .limit(10);
  const svIds = ((svData ?? []) as Array<{ condo_id: string }>).map((s) => s.condo_id);
  let topSuperValue: TopCondo[] = [];
  if (svIds.length) {
    const { data: svCondos } = await supabase
      .from("condos_published")
      .select("id, name, regions(name), province")
      .in("id", svIds);
    const map = new Map(
      ((svCondos ?? []) as unknown as Array<{
        id: string;
        name: string;
        regions: { name: string } | { name: string }[] | null;
        province: string;
      }>).map((c) => [c.id, c])
    );
    topSuperValue = ((svData ?? []) as Array<{ condo_id: string; bubble_index: number }>)
      .map((s) => {
        const c = map.get(s.condo_id);
        if (!c) return null;
        return {
          id: c.id,
          name: c.name,
          region: (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? null,
          province: c.province,
          metric: s.bubble_index,
          isSuperValue: true,
        } as TopCondo;
      })
      .filter((x): x is TopCondo => x !== null);
  }

  const provLabel = (slug: string) => {
    const p = PROVINCES.find((x) => x.slug === slug);
    return p ? (p[lang as Lang] ?? p.en) : slug;
  };

  const fmtMoney = (n: number | null): string => {
    if (n == null) return "—";
    return `$${Math.round(n).toLocaleString()}`;
  };

  // SVG histogram dims
  const VIEW_W = 720;
  const VIEW_H = 220;
  const PAD_LEFT = 16;
  const PAD_RIGHT = 16;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 40;
  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const barW = (innerW / HISTOGRAM_BUCKETS.length) * 0.78;
  const barGap = (innerW / HISTOGRAM_BUCKETS.length) * 0.22;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  return (
    <main className="max-w-5xl mx-auto p-6 sm:p-8">
      {/* Hero */}
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{t.title}</h1>
        <p className="text-zinc-400 mt-3 text-base sm:text-lg max-w-2xl leading-relaxed">
          {t.lead}
        </p>
      </header>

      {/* Big numbers */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.statsHeader}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { n: buildingsTotal.count ?? 0, l: t.statBuildings },
            { n: listingsTotal.count ?? 0, l: t.statListings },
            { n: chartPointsTotal.count ?? 0, l: t.statChartPoints },
            { n: regionsTotal.count ?? 0, l: t.statRegions },
            { n: PROVINCES.length, l: t.statCities },
            { n: 3, l: t.statLangs },
          ].map((s) => (
            <div
              key={s.l}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 backdrop-blur"
            >
              <div className="text-3xl sm:text-4xl font-black tabular-nums bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
                {s.n.toLocaleString()}
              </div>
              <div className="text-[11px] sm:text-xs text-zinc-500 mt-1 leading-tight">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-city table */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.perCityHeader}
        </h2>
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-400 text-[10px] uppercase tracking-wider bg-zinc-950/40">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">{t.perCityCity}</th>
                <th className="text-right px-4 py-3 font-semibold">{t.perCityBuildings}</th>
                <th className="text-right px-4 py-3 font-semibold">{t.perCityScored}</th>
                <th className="text-right px-4 py-3 font-semibold">{t.perCityMedianPrice}</th>
                <th className="text-right px-4 py-3 font-semibold">{t.perCityMedianBubble}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {cityStats.map((c) => {
                const href =
                  c.slug === "bangkok" ? `/${lang}` : `/${lang}/city/${c.slug}`;
                return (
                  <tr key={c.slug} className="hover:bg-zinc-900/40 transition">
                    <td className="px-4 py-3">
                      <Link href={href} className="text-zinc-100 hover:text-blue-300 font-semibold">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-200 tabular-nums">
                      {c.buildings.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400 tabular-nums">
                      {c.scored.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-200 tabular-nums">
                      {fmtMoney(c.medianSale)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.medianBubble != null ? (
                        <span
                          className={
                            c.medianBubble > 130
                              ? "text-rose-400 font-semibold"
                              : c.medianBubble < 90
                              ? "text-emerald-400 font-semibold"
                              : "text-zinc-300"
                          }
                        >
                          {Math.round(c.medianBubble)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bubble Index histogram */}
      <section className="mb-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
          {t.bubbleHeader}
        </h2>
        <p className="text-zinc-500 text-xs mb-4 max-w-2xl leading-relaxed">{t.bubbleNote}</p>
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto block">
            {HISTOGRAM_BUCKETS.map((b, i) => {
              const count = histogram[i];
              const h = (count / histMax) * innerH;
              const x = PAD_LEFT + i * (barW + barGap);
              const y = PAD_TOP + (innerH - h);
              return (
                <g key={`${b.lo}-${b.hi}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    fill={b.color}
                    rx={4}
                    opacity={0.85}
                  />
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="700"
                    fill="#fafafa"
                  >
                    {count}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={VIEW_H - PAD_BOTTOM + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#a1a1aa"
                  >
                    {t.bubbleBucketLabel(b.lo, b.hi)}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={VIEW_H - PAD_BOTTOM + 32}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#52525b"
                  >
                    Bubble
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Top 10 most expensive */}
      {topExpensive.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
            {t.topMostExpensiveHeader}
          </h2>
          <ol className="space-y-1.5">
            {topExpensive.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/${lang}/condo/${c.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-600 transition"
                >
                  <span className="text-zinc-500 text-xs tabular-nums w-5">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-zinc-100 font-semibold truncate block">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {provLabel(c.province)} · {c.region ?? "—"}
                    </span>
                  </span>
                  <span className="text-zinc-200 font-bold tabular-nums whitespace-nowrap">
                    {fmtMoney(c.metric)}
                    <span className="text-[10px] text-zinc-500 font-normal ml-1">/sqm</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-zinc-500 mt-3">
            Ranked by sale price per sqm (the per-project median field
            saturates at $671k, so per-sqm gives a true spread). Duplicates by
            project name are collapsed.
          </p>
        </section>
      )}

      {/* Top 10 Super Value */}
      {topSuperValue.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">
            {t.topSuperValueHeader}
          </h2>
          <ol className="space-y-1.5">
            {topSuperValue.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/${lang}/condo/${c.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border border-emerald-800/40 rounded-lg hover:border-emerald-600/60 transition"
                >
                  <span className="text-zinc-500 text-xs tabular-nums w-5">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-zinc-100 font-semibold truncate block">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {provLabel(c.province)} · {c.region ?? "—"}
                    </span>
                  </span>
                  <span className="bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5">
                    {t.superValueBadge}
                  </span>
                  {c.metric != null && (
                    <span className="text-emerald-400 font-bold tabular-nums text-sm">
                      {Math.round(c.metric)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="text-zinc-500 text-xs italic text-center mt-8">{t.pageCTA}</p>
    </main>
  );
}
