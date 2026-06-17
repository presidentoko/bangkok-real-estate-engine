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

type InfluencerCard = {
  name: string;
  platform: string | null;
  count: number;
  avgBubble: number;
  maxBubble: number;
  promos: Promo[];
};

const PROVINCES: Array<{ slug: string; en: string; ko: string; th: string }> = [
  { slug: "bangkok",   en: "Bangkok",   ko: "방콕",   th: "กรุงเทพ" },
  { slug: "pattaya",   en: "Pattaya",   ko: "파타야",  th: "พัทยา" },
  { slug: "phuket",    en: "Phuket",    ko: "푸켓",   th: "ภูเก็ต" },
  { slug: "huahin",    en: "Hua Hin",   ko: "후아힌",  th: "หัวหิน" },
  { slug: "chonburi",  en: "Chonburi",  ko: "촌부리",  th: "ชลบุรี" },
  { slug: "chiangmai", en: "Chiang Mai",ko: "치앙마이", th: "เชียงใหม่" },
];

function influencerGrade(avgBubble: number): { grade: string; color: string; label: string } {
  if (avgBubble >= 200) return { grade: "F", color: "text-red-400",    label: "Chronically overpriced picks" };
  if (avgBubble >= 160) return { grade: "D", color: "text-orange-400", label: "Mostly overpriced" };
  if (avgBubble >= 130) return { grade: "C", color: "text-yellow-400", label: "Significantly overpriced" };
  if (avgBubble >= 115) return { grade: "B", color: "text-zinc-300",   label: "Somewhat overpriced" };
  return                        { grade: "A", color: "text-emerald-400",label: "Roughly fair picks" };
}

async function fetchTopBubblePerProvince(): Promise<Case[]> {
  const supabase = getServerSupabase();
  const out: Case[] = [];

  for (const p of PROVINCES) {
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

    scores.sort((a, b) => (b.bubble_index ?? 0) - (a.bubble_index ?? 0));
    const top = scores.slice(0, 5).filter((s) => s.bubble_index > 115);
    if (!top.length) continue;

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
      out.push({ condo_id: s.condo_id, name: c.name, region, province: p.slug, bubble_index: s.bubble_index, flood_risk_level: riskMap.get(s.condo_id) ?? null });
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
      .select("promotion_id, condo_id, name, region_name, promoted_by, platform, claim, bubble_index, added_at")
      .order("added_at", { ascending: false })
      .limit(100),
    fetchTopBubblePerProvince(),
  ]);

  const promos: Promo[] = promosRes.data ?? [];

  // ── Stats ──────────────────────────────────────────────
  const promosWithBubble = promos.filter((p) => p.bubble_index != null);
  const avgOverpriced = promosWithBubble.length
    ? Math.round(promosWithBubble.reduce((s, p) => s + (p.bubble_index! - 100), 0) / promosWithBubble.length)
    : null;
  const uniqueInfluencers = new Set(promos.map((p) => p.promoted_by)).size;

  // ── Influencer grouping ────────────────────────────────
  const influencerMap = new Map<string, InfluencerCard>();
  for (const p of promos) {
    const key = p.promoted_by;
    const existing = influencerMap.get(key);
    if (!existing) {
      influencerMap.set(key, { name: p.promoted_by, platform: p.platform, count: 1, avgBubble: p.bubble_index ?? 100, maxBubble: p.bubble_index ?? 100, promos: [p] });
    } else {
      existing.count++;
      existing.promos.push(p);
      if (p.bubble_index != null) {
        existing.maxBubble = Math.max(existing.maxBubble, p.bubble_index);
        const withBubble = existing.promos.filter(x => x.bubble_index != null);
        existing.avgBubble = withBubble.reduce((s, x) => s + x.bubble_index!, 0) / withBubble.length;
      }
    }
  }
  const influencers = Array.from(influencerMap.values()).sort((a, b) => b.avgBubble - a.avgBubble);

  // ── Time accountability: promos > 6 months old ─────────
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const oldPromos = promos.filter((p) => p.added_at < sixMonthsAgo);
  const recentPromos = promos.filter((p) => p.added_at >= sixMonthsAgo);

  // ── Promos with actual claims (for fact-check cards) ───
  const claimPromos = recentPromos.filter((p) => p.claim && p.claim.trim().length > 5);

  const provinceLabel = (slug: string): string => {
    const p = PROVINCES.find((x) => x.slug === slug);
    if (!p) return slug;
    return p[lang as Lang] ?? p.en;
  };

  const platformIcon = (platform: string | null) => {
    if (!platform) return "🔗";
    if (platform.toLowerCase().includes("youtube")) return "▶";
    if (platform.toLowerCase().includes("instagram")) return "📸";
    if (platform.toLowerCase().includes("tiktok")) return "🎵";
    if (platform.toLowerCase().includes("facebook")) return "📘";
    return "🔗";
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-14">

      {/* ── Header ── */}
      <header className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t.reality.title}</h1>
          <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">{t.reality.lead}</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-rose-400">
              {promos.length}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Claims tracked</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-rose-400">
              {avgOverpriced != null ? `+${avgOverpriced}%` : "—"}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Avg. overpriced vs district</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold tabular-nums text-zinc-200">
              {uniqueInfluencers}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Influencers tracked</div>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-zinc-600 max-w-md">
            We don&apos;t attack the person — only the numbers. Sponsor a slot and we&apos;ll run your claim next to our data.
          </p>
          <Link
            href={`/${lang}/contact`}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 shrink-0"
          >
            {t.reality.sponsorCta}
          </Link>
        </div>
      </header>

      {/* ── Section 1: Claim vs Reality Fact-Check Cards ── */}
      {claimPromos.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-1">
              📢 Claim vs Reality
            </h2>
            <p className="text-zinc-500 text-xs">
              Actual marketing language used to sell these condos — next to what our data shows.
            </p>
          </div>

          <div className="space-y-4">
            {claimPromos.map((r) => {
              const above = r.bubble_index != null ? Math.round(r.bubble_index - 100) : null;
              const severity = above == null ? "neutral" : above > 100 ? "extreme" : above > 50 ? "high" : above > 20 ? "medium" : "low";
              const borderColor = { extreme: "border-red-500/60", high: "border-rose-500/40", medium: "border-orange-500/30", low: "border-yellow-500/20", neutral: "border-zinc-700" }[severity];
              const badgeColor = { extreme: "bg-red-500/20 text-red-300", high: "bg-rose-500/15 text-rose-300", medium: "bg-orange-500/15 text-orange-300", low: "bg-yellow-500/10 text-yellow-300", neutral: "bg-zinc-800 text-zinc-400" }[severity];
              const verdict = above == null ? null : above > 100 ? "Extremely overpriced" : above > 50 ? "Heavily overpriced" : above > 20 ? "Overpriced" : above > 0 ? "Slightly overpriced" : "Roughly fair";

              return (
                <Link
                  key={r.promotion_id}
                  href={`/${lang}/reality/${r.promotion_id}`}
                  className={`block rounded-2xl border ${borderColor} overflow-hidden hover:bg-zinc-900/50 transition`}
                >
                  {/* Claim — big and prominent */}
                  <div className="bg-rose-950/20 px-5 py-4 border-b border-zinc-800">
                    <div className="text-[10px] uppercase tracking-wider text-rose-400/70 mb-2">
                      {platformIcon(r.platform)} {r.promoted_by} · {r.platform ?? "promoted"}
                    </div>
                    <div className="text-base sm:text-lg font-medium text-zinc-100 italic leading-snug">
                      &ldquo;{r.claim}&rdquo;
                    </div>
                    <div className="text-xs text-zinc-500 mt-2">{r.name} · {r.region_name ?? "—"}</div>
                  </div>

                  {/* Reality */}
                  <div className="bg-zinc-950 px-5 py-3 flex flex-wrap items-center gap-4">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 shrink-0">
                      RealData says:
                    </div>
                    {above != null && (
                      <div className={`text-sm font-bold px-2.5 py-1 rounded-full ${badgeColor}`}>
                        {above > 0 ? `+${above}%` : `${above}%`} vs district
                      </div>
                    )}
                    {verdict && (
                      <div className="text-xs text-zinc-400">{verdict}</div>
                    )}
                    <div className="ml-auto text-xs text-zinc-600">See full breakdown →</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 2: Influencer Report Cards ── */}
      {influencers.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-1">
              🎙 Influencer Report Cards
            </h2>
            <p className="text-zinc-500 text-xs">
              How accurate are their picks? Graded by average Bubble Index of all condos they&apos;ve promoted.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {influencers.map((inf) => {
              const g = influencerGrade(inf.avgBubble);
              const initials = inf.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div
                  key={inf.name}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{inf.name}</div>
                      <div className="text-xs text-zinc-500">
                        {platformIcon(inf.platform)} {inf.platform ?? "?"} · {inf.count} condo{inf.count !== 1 ? "s" : ""} promoted
                      </div>
                    </div>
                    <div className={`ml-auto text-3xl font-black shrink-0 ${g.color}`}>
                      {g.grade}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-800/50 rounded-xl p-2.5">
                      <div className="text-zinc-500 mb-0.5">Avg overpriced</div>
                      <div className={`font-bold tabular-nums ${inf.avgBubble > 130 ? "text-rose-400" : "text-zinc-300"}`}>
                        +{Math.round(inf.avgBubble - 100)}%
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-2.5">
                      <div className="text-zinc-500 mb-0.5">Worst pick</div>
                      <div className="font-bold tabular-nums text-rose-400">
                        +{Math.round(inf.maxBubble - 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-600 italic">{g.label}</div>

                  {/* Their picks preview */}
                  <div className="space-y-1">
                    {inf.promos.slice(0, 3).map((p) => (
                      <div key={p.promotion_id} className="flex items-center justify-between text-xs text-zinc-500 gap-2">
                        <span className="truncate">{p.name}</span>
                        {p.bubble_index != null && (
                          <span className={`shrink-0 font-semibold tabular-nums ${p.bubble_index > 130 ? "text-rose-400" : "text-zinc-400"}`}>
                            +{Math.round(p.bubble_index - 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                    {inf.count > 3 && (
                      <div className="text-xs text-zinc-600">+{inf.count - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 3: AI Auto-Flagged ── */}
      {cases.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
              🤖 Auto-Flagged: No influencer needed
            </h2>
            <p className="text-zinc-500 text-xs max-w-xl leading-relaxed">
              {t.reality.casesIntro}
            </p>
          </div>

          <div className="space-y-3">
            {cases.map((c) => {
              const above = Math.round(c.bubble_index - 100);
              const cityClaim = t.reality.claimByMarket[c.province as keyof typeof t.reality.claimByMarket] ?? "";
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
                      <div className="text-sm text-zinc-300 italic leading-snug">{cityClaim}</div>
                    </div>
                    <div className="p-3 bg-emerald-950/15">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">
                        {t.reality.realDataLabel}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                        <span className="text-rose-400 font-bold tabular-nums">+{above}%</span>
                        <span className="text-zinc-500 text-[11px] self-center">{t.reality.vsDistrict}</span>
                        {c.flood_risk_level != null && (
                          <span className="text-xs text-zinc-400">
                            {c.flood_risk_level >= 4 ? "⚠ " : ""}Flood L{c.flood_risk_level}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Section 4: Time Accountability ── */}
      {oldPromos.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
              ⏳ Time Proves Everything — 6+ months later
            </h2>
            <p className="text-zinc-500 text-xs max-w-xl">
              These condos were promoted over 6 months ago. The claims were made. The data hasn&apos;t changed.
            </p>
          </div>

          <div className="space-y-2">
            {oldPromos.map((r) => {
              const above = r.bubble_index != null ? Math.round(r.bubble_index - 100) : null;
              const monthsAgo = Math.floor((Date.now() - new Date(r.added_at).getTime()) / (30 * 24 * 60 * 60 * 1000));
              return (
                <Link
                  key={r.promotion_id}
                  href={`/${lang}/reality/${r.promotion_id}`}
                  className="flex items-start gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700 transition"
                >
                  <div className="text-center shrink-0">
                    <div className="text-lg font-bold tabular-nums text-zinc-500">{monthsAgo}</div>
                    <div className="text-[10px] text-zinc-600">mo ago</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate text-zinc-300">{r.name}</div>
                    {r.claim && (
                      <div className="text-xs text-zinc-500 italic mt-0.5 line-clamp-1">&ldquo;{r.claim}&rdquo;</div>
                    )}
                    <div className="text-xs text-zinc-600 mt-0.5">
                      {platformIcon(r.platform)} {r.promoted_by}
                    </div>
                  </div>
                  {above != null && (
                    <div className={`shrink-0 text-right ${above > 20 ? "text-rose-400" : "text-zinc-400"}`}>
                      <div className="font-bold tabular-nums">{above > 0 ? `+${above}%` : `${above}%`}</div>
                      <div className="text-[10px] text-zinc-600">{t.reality.vsDistrict}</div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {promos.length === 0 && cases.length === 0 && (
        <div className="text-center py-20 text-zinc-600">
          <div className="text-4xl mb-3">📭</div>
          <p>{t.reality.emptyState}</p>
        </div>
      )}

    </main>
  );
}
