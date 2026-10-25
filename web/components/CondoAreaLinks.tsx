import Link from "next/link";
import { areaLabel, cityName } from "@/components/YieldAreaView";
import { COMPARE_PAIRS, stationDisplayName } from "@/lib/comparePairs";
import { getDictionary } from "@/lib/getDictionary";
import type { Lang } from "@/lib/i18n";
import { findFeeCity, getFeeAreaIndex } from "@/lib/queries/feeAreas";
import { getYieldAreaIndex } from "@/lib/queries/yieldAreas";
import { areaKeys, findYieldArea } from "@/lib/yieldAreas";

/**
 * The crawl path from a condo page into /yield/, /fees/ and /vs/.
 *
 * Those three routes went live in September and October 2026 and between
 * them earned **one** impression in the 90 days to 2026-10-25, from
 * /en/yield/bangkok, at position 3. They are live, canonical, and all 1,386
 * of their URLs are in sitemap-areas.xml — Google simply had almost no
 * reason to walk to them. Their only inbound links were the home page
 * (34 impressions, average position 66.8) and the district pages.
 *
 * Condo pages are where the crawl actually happens: 928 distinct ones drew
 * 1,982 of the site's 2,282 impressions in the same window. Linking out
 * from them, with the area's measured number in the anchor text, is the
 * difference between a page Google has seen and one it has not.
 *
 * Every link is resolved against the same index the destination page is
 * built from, so a sub-bar area renders nothing rather than linking a 404 —
 * the rule YieldAreaLink already follows.
 */
export async function CondoAreaLinks({
  lang,
  province,
  region,
  stationSlug,
}: {
  lang: Lang;
  province: string | null;
  region: string | null;
  /** The condo's nearest BTS/MRT station slug, for the /vs/ station pairs. */
  stationSlug: string | null;
}) {
  const [yieldIndex, feeIndex] = await Promise.all([
    getYieldAreaIndex().catch(() => null),
    getFeeAreaIndex().catch(() => null),
  ]);
  const { city, district } = areaKeys({ province, region });
  const t = getDictionary(lang);

  const items: React.ReactNode[] = [];

  // Rental yield for this building's own district, falling back to the city.
  if (yieldIndex) {
    const area =
      findYieldArea(yieldIndex, city, district ?? undefined) ?? findYieldArea(yieldIndex, city);
    if (area) {
      const key = area.district?.district ?? null;
      const s = (area.district ?? area.city).stats;
      items.push(
        <li key="yield">
          <Link href={key ? `/${lang}/yield/${city}/${key}` : `/${lang}/yield/${city}`}>
            {t.yieldArea.linkLine(areaLabel(city, key, lang), (s.median ?? 0).toFixed(1), s.count)}
          </Link>
        </li>,
      );
    }
  }

  // What a unit in this city costs to run every month.
  if (feeIndex) {
    const fee = findFeeCity(feeIndex, city);
    if (fee) {
      items.push(
        <li key="fees">
          <Link href={`/${lang}/fees/${city}`}>
            {t.condoPage.feesCityLink(
              cityName(city, lang),
              Math.round(fee.stats.median ?? 0).toLocaleString("en-US"),
            )}
          </Link>
        </li>,
      );
    }
  }

  // "Thonglor vs Ekkamai" — only when this building actually sits on one
  // side of a published pair. Station pairs match the nearest station;
  // district pairs match the khet/amphoe, and only inside their own city.
  const pair = COMPARE_PAIRS.find((p) =>
    p.kind === "station"
      ? stationSlug != null && (p.a === stationSlug || p.b === stationSlug)
      : p.city === city && district != null && (p.a === district || p.b === district),
  );
  if (pair) {
    const label = (side: string) =>
      pair.kind === "station" ? stationDisplayName(side) : areaLabel(city, side, lang);
    items.push(
      <li key="vs">
        <Link href={`/${lang}/vs/${pair.slug}`}>
          {t.condoPage.areaVsLink(label(pair.a), label(pair.b))}
        </Link>
      </li>,
    );
  }

  if (items.length === 0) return null;
  return <>{items}</>;
}
