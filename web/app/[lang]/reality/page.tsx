import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  if (!isLang(lang)) return { title: "Marketing vs Reality — RealData" };
  const t = getDictionary(lang);
  return {
    title: `${t.reality.title} — RealData`,
    description: t.reality.lead,
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/reality`,
      languages: langAlternates("/reality"),
    },
  };
}

type Promo = {
  promotion_id: string;
  condo_id: string;
  name: string;
  region_name: string | null;
  promoted_by: string;
  platform: string | null;
  claim: string | null;
  bubble_index: number | null;
  added_at: string;
};

type Case = {
  condo_id: string;
  name: string;
  region: string | null;
  province: string;
  bubble_index: number;
  flood_risk_level: number | null;
};

const PROVINCES: Array<{ slug: string; en: string; ko: string; th: string }> = [
  { slug: "bangkok", en: "Bangkok", ko: "방콕", th: "กรุงเทพ" },
  { slug: "pattaya", en: "Pattaya", ko: "파타야", th: "พัทยา" },
  { slug: "phuket", en: "Phuket", ko: "푸켓", th: "ภูเก็ต" },
  { slug: "huahin", en: "Hua Hin", ko: "후아힌", th: "หัวหิน" },
  { slug: "chonburi", en: "Chonburi", ko: "촌부리", th: "ชลบุรี" },
  { slug: "chiangmai", en: "Chiang Mai", ko: "치앙마이", th: "เชียงใหม่" },
];

async function fetchTopBubblePerProvince(): Promise<Case[]> {
  const supabase = getServerSupabase();
  const out: Case[] = [];

  for (const p of PROVINCES) {
    // 1. Province condo IDs
    const { data: condos } = await supabase
      .from("condos_published")
      .select("id, name, regions(name)")
      .eq("province", p.slug)
      .limit(500);
    const ids = (condos ?? []).map((c) => (c as { id: string }).id);
    if (!ids.length) continue;
    const idMap = new Map(
      ((condos ?? []) as unknown as Array<{
        id: string;
        name: string;
        regions: { name: string } | { name: string }[] | null;
      }>).map((c) => [c.id, c])
    );

    // 2. Their bubble_index in chunks
    type ScoreRow = { condo_id: string; bubble_index: number };
    const scores: ScoreRow[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: s } = await supabase
        .from("value_scores")
        .select("condo_id, bubble_index")
        .in("condo_id", chunk);
      scores.push(...((s ?? []) as ScoreRow[]));
    }

    // 3. Pick top 3 by bubble_index per province
    scores.sort((a, b) => (b.bubble_index ?? 0) - (a.bubble_index ?? 0));
    const top = scores.slice(0, 3).filter((s) => s.bubble_index > 130);
    if (!top.length) continue;

    // 4. Pull flood_risk_level for those (Bangkok-only data, but
    //    column exists for all)
    const topIds = top.map((s) => s.condo_id);
    const { data: risks } = await supabase
      .from("risk_factors")
      .select("condo_id, flood_risk_level")
      .in("condo_id", topIds);
    const riskMap = new Map(
      ((risks ?? []) as Array<{ condo_id: string; flood_risk_level: number | null }>).map(
        (r) => [r.condo_id, r.flood_risk_level]
      )
    );

    for (const s of top) {
      const c = idMap.get(s.condo_id);
      if (!c) continue;
      const region = (Array.isArray(c.regions) ? c.regions[0] : c.regions)?.name ?? null;
      out.push({
        condo_id: s.condo_id,
        name: c.name,
        region,
        province: p.slug,
        bubble_index: s.bubble_index,
        flood_risk_level: riskMap.get(s.condo_id) ?? null,
      });
    }
  }
  return out;
}

export default async function RealityIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  const supabase = getServerSupabase();
  const [promosRes, cases] = await Promise.all([
    supabase
      .from("v_promoted_condos")
      .select(
        "promotion_id, condo_id, name, region_name, promoted_by, platform, claim, bubble_index, added_at"
      )
      .order("added_at", { ascending: false })
      .limit(50),
    fetchTopBubblePerProvince(),
  ]);

  const promos: Promo[] = promosRes.data ?? [];
  const provinceLabel = (slug: string): string => {
    const p = PROVINCES.find((x) => x.slug === slug);
    if (!p) return slug;
    return p[lang as Lang] ?? p.en;
  };

  return (
    <main className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{t.reality.title}</h1>
        <p className="text-zinc-400 text-sm max-w-xl">{t.reality.lead}</p>
        <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-400 max-w-xl">
          {t.reality.note}
        </div>
        <Link
          href={`/${lang}/contact?type=promote`}
          className="inline-block mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300"
        >
          {t.reality.sponsorCta}
        </Link>
      </header>

      {/* Auto-flagged data cases */}
      {cases.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-1">
            {t.reality.casesHeader}
          </h2>
          <p className="text-zinc-500 text-xs mb-4 max-w-xl leading-relaxed">
            {t.reality.casesIntro}
          </p>
          <div className="space-y-3">
            {cases.map((c) => {
              const above = Math.round(c.bubble_index - 100);
              const cityClaim =
                t.reality.claimByMarket[
                  c.province as keyof typeof t.reality.claimByMarket
                ] ?? "";
              return (
                <Link
                  key={c.condo_id}
                  href={`/${lang}/condo/${c.condo_id}`}
                  className="block rounded-xl bg-zinc-900 hover:bg-zinc-800 transition border border-zinc-800 overflow-hidden"
                >
                  <div className="px-4 pt-3 flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {provinceLabel(c.province)} · {c.region ?? "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-zinc-800 mt-3 border-t border-zinc-800">
                    <div className="p-3 bg-rose-950/15">
                      <div className="text-[10px] uppercase tracking-wider text-rose-300/70 mb-1">
                        {t.reality.marketingLabel}
                      </div>
                      <div className="text-sm text-zinc-300 italic leading-snug">
                        {cityClaim}
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-950/15">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">
                        {t.reality.realDataLabel}
                      </div>
                      <div className="text-sm flex items-baseline gap-2 leading-snug">
                        <span className="text-rose-400 font-bold tabular-nums">
                          +{above}%
                        </span>
                        <span className="text-zinc-500 text-[11px]">
                          {t.reality.vsDistrict}
                        </span>
                      </div>
                      {c.flood_risk_level != null && (
                        <div className="text-xs text-zinc-400 mt-1">
                          {t.reality.floodLabel} L{c.flood_risk_level}/5
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Sponsored slots */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-3">
          {t.reality.sponsoredHeader}
        </h2>
        {promosRes.error && (
          <div className="text-red-400 text-sm mb-3">DB error: {promosRes.error.message}</div>
        )}
        {promos.length === 0 ? (
          <div className="text-zinc-500 text-sm">{t.reality.emptyState}</div>
        ) : (
          <ul className="space-y-2">
            {promos.map((r) => {
              const above =
                r.bubble_index != null ? r.bubble_index - 100 : null;
              return (
                <li key={r.promotion_id}>
                  <Link
                    href={`/${lang}/reality/${r.promotion_id}`}
                    className="block p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition border border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{r.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {r.region_name ?? "—"} · {t.reality.promotedBy} {r.promoted_by} (
                          {r.platform ?? "?"})
                        </div>
                        {r.claim && (
                          <div className="text-sm text-zinc-300 italic mt-2">
                            &ldquo;{r.claim}&rdquo;
                          </div>
                        )}
                      </div>
                      {above != null && (
                        <div
                          className={`text-right shrink-0 font-bold ${
                            above > 15
                              ? "text-red-400"
                              : above < -15
                              ? "text-emerald-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {above > 0 ? `+${above.toFixed(1)}%` : `${above.toFixed(1)}%`}
                          <div className="text-[10px] text-zinc-500 font-normal">
                            {t.reality.vsDistrict}
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
