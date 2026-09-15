import Link from "next/link";
import { areaLabel, cityName } from "@/components/YieldAreaView";
import { getDictionary } from "@/lib/getDictionary";
import type { Lang } from "@/lib/i18n";
import { getYieldAreaIndex } from "@/lib/queries/yieldAreas";
import { areaKeys, findYieldArea } from "@/lib/yieldAreas";

/** "Rental yield in Sathorn, Bangkok: 5.4% median across 55 condos" — the
 *  crawl path from the district and city pages into /yield/. Renders nothing
 *  for an area below the page's eligibility bar, so it never links a 404. */
export async function YieldAreaLink({
  lang,
  province,
  region,
}: {
  lang: Lang;
  province: string | null;
  region: string | null;
}) {
  const index = await getYieldAreaIndex().catch(() => null);
  if (!index) return null;
  const { city, district } = areaKeys({ province, region });
  const area = findYieldArea(index, city, district ?? undefined) ?? findYieldArea(index, city);
  if (!area) return null;
  const key = area.district?.district ?? null;
  const s = (area.district ?? area.city).stats;
  const t = getDictionary(lang).yieldArea;
  return (
    <Link
      href={key ? `/${lang}/yield/${city}/${key}` : `/${lang}/yield/${city}`}
      className="inline-block text-sm text-emerald-400 hover:underline"
    >
      {t.linkLine(areaLabel(city, key, lang), (s.median ?? 0).toFixed(1), s.count)} →
    </Link>
  );
}

/** Every city with a /yield/ page, for the national /yields ranking. */
export async function YieldCityChips({ lang }: { lang: Lang }) {
  const index = await getYieldAreaIndex().catch(() => null);
  if (!index || index.cities.length === 0) return null;
  const t = getDictionary(lang).yieldArea;
  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">{t.byCityTitle}</h2>
      <ul className="flex flex-wrap gap-2">
        {index.cities.map((c) => (
          <li key={c.city}>
            <Link
              href={`/${lang}/yield/${c.city}`}
              className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
            >
              {cityName(c.city, lang)}
              <span className="text-zinc-500"> · {(c.stats.median ?? 0).toFixed(1)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
