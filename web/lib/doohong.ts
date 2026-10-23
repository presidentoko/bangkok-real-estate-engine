// Links to DooHong (doohong.com), the founder's Bangkok condo-interiors site:
// real interiors by building plus quotes from vetted studios.
//
// Same owner, same topic, so these are plain followed links. Every URL carries
// utm_source=passionaryestate so DooHong's analytics can tell this traffic
// apart; utm_medium says which placement sent it.
//
// The building map is a static file generated from DooHong's project list by
// scripts/doohong/gen_doohong_map.py. Nothing here calls DooHong at build or
// request time. A building DooHong does not have links to DooHong's home.
import { DOOHONG_BUILDINGS as BUILDINGS } from "./doohongBuildings.ts";
import type { Lang } from "./i18n";

const DOOHONG_ORIGIN = "https://doohong.com";

// DooHong serves Thai at the root, English under /en, Korean under /ko.
const LOCALE_PREFIX: Record<Lang, string> = { th: "", en: "/en", ko: "/ko" };

// DooHong covers Bangkok and the Samut Prakan / Nonthaburi districts next to
// it; a same-named building elsewhere in Thailand is not the same building.
// Keep in step with GREATER_BANGKOK in scripts/doohong/gen_doohong_map.py.
const GREATER_BANGKOK = new Set(["bangkok", "samut-prakan", "nonthaburi", "pathum-thani"]);

export type DooHongMedium = "building_page" | "footer" | "about";

/** Same normalisation as scripts/backfill_condo_slug.py:slugify, which is
 *  also how the map's keys were built. */
export function slugifyName(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function withUtm(url: string, medium: DooHongMedium): string {
  return `${url}?utm_source=passionaryestate&utm_medium=${medium}`;
}

/** DooHong's home page in the reader's language. */
export function doohongHomeUrl(lang: Lang, medium: DooHongMedium): string {
  return withUtm(`${DOOHONG_ORIGIN}${LOCALE_PREFIX[lang] || "/"}`, medium);
}

/** The DooHong slug for a RealData condo, or null when DooHong has no page. */
export function doohongSlugFor(
  name: string | null | undefined,
  province: string | null | undefined,
): string | null {
  const prov = slugifyName(province) || "bangkok";
  if (!GREATER_BANGKOK.has(prov)) return null;
  const key = slugifyName(name);
  return (key && BUILDINGS[key]) || null;
}

/** Where a condo page's "Interiors in this building" link goes: the same
 *  building on DooHong when it exists there, else DooHong's home. */
export function doohongBuildingLink(
  name: string | null | undefined,
  province: string | null | undefined,
  lang: Lang,
): { href: string; matched: boolean } {
  const slug = doohongSlugFor(name, province);
  if (!slug) return { href: doohongHomeUrl(lang, "building_page"), matched: false };
  return {
    href: withUtm(`${DOOHONG_ORIGIN}${LOCALE_PREFIX[lang]}/condo/${slug}`, "building_page"),
    matched: true,
  };
}
