import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CITIES } from "@/lib/cities";
import { isLang } from "@/lib/i18n";
import { langAlternates, SEO_SITE_URL } from "@/lib/seo";
import { getServerSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return { title: "Retiree-Friendly Condos in Thailand" };
  return {
    title: "Retiree-Friendly Condos in Thailand — RealData",
    description:
      "Find the best condos for retirees across Thailand. Ranked by healthcare access, air quality, transit, and daily errands. Data-driven, no developer sponsorships.",
    alternates: {
      canonical: `${SEO_SITE_URL}/${lang}/retiree`,
      languages: langAlternates("/retiree"),
    },
  };
}

type CityScore = {
  slug: string;
  count: number;
  avgScore: number | null;
  topScore: number | null;
};

export default async function RetireeLanding({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const supabase = getServerSupabase();

  // Fetch retiree score stats per city
  const cityStats = await Promise.all(
    CITIES.map(async (city) => {
      const { data } = await supabase
        .from("condos")
        .select("retiree_score")
        .in("province", [city.slug, city.slug.replace("-", "")])
        .gte("retiree_score", 55)
        .eq("is_active", true)
        .order("retiree_score", { ascending: false })
        .limit(60);

      const rows = data ?? [];
      if (rows.length === 0) return { slug: city.slug, count: 0, avgScore: null, topScore: null };
      const scores = rows.map((r) => r.retiree_score as number);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        slug: city.slug,
        count: rows.length,
        avgScore: Math.round(avg * 10) / 10,
        topScore: scores[0],
      } as CityScore;
    }),
  );

  const activeCities = cityStats.filter((c) => c.count >= 3);
  const comingSoon = cityStats.filter((c) => c.count < 3);

  const gradeLabel = (score: number | null) => {
    if (!score) return null;
    if (score >= 75) return { label: "Excellent", color: "text-emerald-400" };
    if (score >= 55) return { label: "Good", color: "text-emerald-300" };
    return null;
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-3xl font-bold mb-2">Retiree-Friendly Condos in Thailand</h1>
        <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
          Every condo scored 0–100 on four factors: healthcare access (40%), air quality (25%),
          transit (20%), and daily errands (15%). Only condos scoring ≥ 55 (Good or better) appear
          below.
        </p>
      </header>

      {/* Score legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { label: "Excellent", range: "≥ 75", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
          { label: "Good", range: "≥ 55", color: "bg-emerald-500/10 text-emerald-400/70 border-emerald-500/20" },
          { label: "Fair", range: "≥ 35", color: "bg-zinc-800 text-zinc-400 border-zinc-700" },
          { label: "Weak", range: "< 35", color: "bg-zinc-900 text-zinc-500 border-zinc-800" },
        ].map((g) => (
          <div key={g.label} className={`px-3 py-1.5 rounded-full border ${g.color}`}>
            {g.label} {g.range}
          </div>
        ))}
      </div>

      {/* Active cities */}
      {activeCities.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Cities with retiree data
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {activeCities.map((c) => {
              const cityObj = CITIES.find((x) => x.slug === c.slug);
              if (!cityObj) return null;
              const grade = gradeLabel(c.topScore);
              return (
                <Link
                  key={c.slug}
                  href={`/${lang}/retiree/${c.slug}`}
                  className="group block bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-semibold group-hover:text-emerald-400 transition">
                      {cityObj.name.en}
                    </h3>
                    {grade && (
                      <span className={`text-xs font-semibold ${grade.color}`}>
                        {grade.label}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-5 text-sm">
                    <div>
                      <div className="text-zinc-500 text-xs">Condos scored ≥55</div>
                      <div className="font-bold tabular-nums">{c.count}</div>
                    </div>
                    {c.avgScore && (
                      <div>
                        <div className="text-zinc-500 text-xs">Avg score</div>
                        <div className="font-bold tabular-nums text-emerald-400">{c.avgScore}</div>
                      </div>
                    )}
                    {c.topScore && (
                      <div>
                        <div className="text-zinc-500 text-xs">Top score</div>
                        <div className="font-bold tabular-nums text-emerald-300">{c.topScore}</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-zinc-500 group-hover:text-zinc-400 transition">
                    View ranked condos →
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Coming soon */}
      {comingSoon.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Coming soon — data updating nightly
          </h2>
          <div className="flex flex-wrap gap-2">
            {comingSoon.map((c) => {
              const cityObj = CITIES.find((x) => x.slug === c.slug);
              if (!cityObj) return null;
              return (
                <div
                  key={c.slug}
                  className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-sm text-zinc-500"
                >
                  {cityObj.name.en}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Methodology note */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 text-sm text-zinc-400 space-y-2">
        <h2 className="text-zinc-200 font-semibold">How the score works</h2>
        <ul className="space-y-1 text-xs leading-relaxed">
          <li>🏥 <span className="text-zinc-300">Healthcare (40%)</span> — hospitals within 1 km via OpenStreetMap</li>
          <li>💨 <span className="text-zinc-300">Air quality (25%)</span> — annual average AQI from monitoring stations</li>
          <li>🚇 <span className="text-zinc-300">Transit (20%)</span> — distance to nearest BTS / MRT station</li>
          <li>🛒 <span className="text-zinc-300">Daily errands (15%)</span> — supermarkets within 1 km</li>
        </ul>
        <p className="text-xs text-zinc-500">
          Scores update nightly as new livability data is processed. Bangkok data is most complete;
          other cities are being back-filled.
        </p>
      </section>
    </main>
  );
}
