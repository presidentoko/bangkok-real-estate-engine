import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingCard } from "@/components/BuildingCard";
import {
  InventoryMap,
  type KhetCount,
  type CondoPoint,
} from "@/components/InventoryMap";
import { getDictionary } from "@/lib/getDictionary";
import { isLang } from "@/lib/i18n";
import { fetchAllCondos, fetchSiteStats, type CondoSummary } from "@/lib/queries/condos";

// Stale while revalidate; data only changes when scrapers run (weekly).
export const revalidate = 3600;

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = getDictionary(lang);

  const [condos, stats] = await Promise.all([
    fetchAllCondos(),
    fetchSiteStats(),
  ]);

  // ---- Aggregations
  const counts = new Map<string, number>();
  const points: CondoPoint[] = [];
  for (const c of condos) {
    if (c.region) counts.set(c.region, (counts.get(c.region) ?? 0) + 1);
    if (c.latitude != null && c.longitude != null) {
      points.push({
        id: c.id,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
        url: c.url,
      });
    }
  }
  const khetCounts: KhetCount[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Featured picks
  const superValue = condos
    .filter((c) => c.is_super_value)
    .slice(0, 3);
  const overpriced = [...condos]
    .filter((c) => c.bubble_index != null && c.hero_image_url)
    .sort((a, b) => (b.bubble_index ?? 0) - (a.bubble_index ?? 0))
    .slice(0, 3);
  const safest = [...condos]
    .filter(
      (c) =>
        c.flood_risk_level != null && c.flood_risk_level <= 1 && c.hero_image_url
    )
    .slice(0, 3);

  return (
    <div>
      {/* Hero */}
      <section className="relative border-b border-zinc-900 overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(236,72,153,0.12),transparent_60%)]" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-pink-400 text-xs font-bold uppercase tracking-widest mb-3">
            {t.home.heroPretitle}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-4xl">
            {t.home.heroTitle1}{" "}
            <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-200 bg-clip-text text-transparent">
              {t.home.heroTitle2Highlight}
            </span>
            {t.home.heroTitle3}
          </h1>
          <p className="text-zinc-400 mt-5 max-w-2xl text-base sm:text-lg leading-relaxed">
            {t.home.heroLead}
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link
              href={`/${lang}/flood`}
              className="bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-400 transition shadow-lg shadow-blue-500/20"
            >
              {t.home.ctaFlood}
            </Link>
            <Link
              href={`/${lang}/inventory`}
              className="bg-zinc-800 text-zinc-100 font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition"
            >
              {t.home.ctaInventory}
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12 max-w-3xl">
            {[
              { n: stats.buildings.toLocaleString(), l: t.home.statsLabels.buildings },
              { n: stats.listings.toLocaleString(), l: t.home.statsLabels.listings },
              { n: stats.chartPoints.toLocaleString(), l: t.home.statsLabels.chartPts },
              { n: "50 / 50", l: t.home.statsLabels.floodMapping },
            ].map((s) => (
              <div
                key={s.l}
                className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 backdrop-blur"
              >
                <div className="text-2xl sm:text-3xl font-black tabular-nums bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
                  {s.n}
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Super Value picks */}
      {superValue.length > 0 && (
        <FeaturedRow
          lang={lang}
          eyebrow="★ SUPER VALUE"
          eyebrowColor="text-emerald-400"
          title="Top picks — central + underpriced + maxed-out amenities"
          subtitle={`${stats.superValue} buildings flagged out of ${stats.withBubble} we scored`}
          condos={superValue}
        />
      )}

      {/* Bubble TOP */}
      <FeaturedRow
        lang={lang}
        eyebrow="❌ BUBBLE WATCH"
        eyebrowColor="text-rose-400"
        title="Most-overpriced vs district — verify before buying"
        subtitle="Same khet, same square meter — these cost 3-4× the local average"
        condos={overpriced}
      />

      {/* Safest from flood */}
      {safest.length > 0 && (
        <FeaturedRow
          lang={lang}
          eyebrow="🌊 DRY HIGH GROUND"
          eyebrowColor="text-sky-400"
          title="Districts that stayed dry in 2011 + every monsoon since"
          subtitle="Flood Level 1/5 — central elevated, robust drainage"
          condos={safest}
        />
      )}

      {/* Feature cards (functional nav) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.home.featuresHeader}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {t.home.features.map((f, i) => {
            const accents = [
              "from-rose-500/20 to-rose-500/5",
              "from-amber-500/20 to-amber-500/5",
              "from-pink-500/20 to-pink-500/5",
              "from-sky-500/20 to-sky-500/5",
            ];
            return (
              <Link
                key={f.href}
                href={`/${lang}${f.href}`}
                className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition overflow-hidden"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${accents[i] ?? accents[0]} opacity-50 group-hover:opacity-100 transition`}
                />
                <div className="relative">
                  <div className="text-3xl mb-3">{f.emoji}</div>
                  <div className="font-bold text-lg">{f.title}</div>
                  <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{f.desc}</p>
                  <div className="mt-3 inline-block text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                    {f.badge}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Inventory map */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-semibold">{t.home.inventoryTitle}</h2>
          <span className="text-zinc-500 text-sm">
            {stats.buildings.toLocaleString()} {t.home.inventoryStatsCondos} ·{" "}
            {khetCounts.length} {t.home.inventoryStatsDistricts} ·{" "}
            <span className="text-amber-400">
              {points.length.toLocaleString()} {t.home.inventoryGeoSuffix}
            </span>
          </span>
          <Link
            href={`/${lang}/inventory`}
            className="text-zinc-300 hover:text-white text-sm underline underline-offset-4 ml-auto"
          >
            {t.home.inventoryFullList}
          </Link>
        </div>
        <InventoryMap
          khetCounts={khetCounts}
          points={points}
          totalBuildings={stats.buildings}
          condoLinkPrefix={`/${lang}/condo/`}
        />
        <p className="text-xs text-zinc-500 mt-2">{t.home.inventoryHelp}</p>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">
          {t.home.faqTitle}
        </h2>
        <div className="space-y-3">
          {t.home.faq.map((f, i) => (
            <details
              key={i}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl p-4 [&_summary]:cursor-pointer"
            >
              <summary className="font-semibold list-none flex items-baseline justify-between gap-3">
                <span>{f.q}</span>
                <span className="text-zinc-500 group-open:rotate-180 transition shrink-0">▾</span>
              </summary>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              inLanguage: lang,
              mainEntity: t.home.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      </section>
    </div>
  );
}

function FeaturedRow({
  lang,
  eyebrow,
  eyebrowColor,
  title,
  subtitle,
  condos,
}: {
  lang: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  subtitle: string;
  condos: CondoSummary[];
}) {
  if (condos.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-4">
        <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${eyebrowColor}`}>
          {eyebrow}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h2>
        <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {condos.map((c) => (
          <BuildingCard key={c.id} condo={c} hrefPrefix={`/${lang}/condo/`} />
        ))}
      </div>
    </section>
  );
}
