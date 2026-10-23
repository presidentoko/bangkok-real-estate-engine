import { doohongBuildingLink } from "@/lib/doohong";
import { getDictionary } from "@/lib/getDictionary";
import type { Lang } from "@/lib/i18n";

/**
 * "Interiors in this building": one line and one link to DooHong, the
 * founder's condo-interiors site. Goes to the same building there when
 * DooHong has it (web/lib/doohongBuildings.json), otherwise to DooHong's home.
 *
 * Server-rendered text only, no image and no client JS, so it cannot shift
 * layout. A plain followed link: same owner, same topic, not a paid placement.
 */
export function DooHongInteriorsCard({
  name,
  province,
  lang,
}: {
  name: string;
  province: string | null;
  lang: Lang;
}) {
  const t = getDictionary(lang).doohong;
  const { href, matched } = doohongBuildingLink(name, province, lang);
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-zinc-300 mb-2">{t.interiorsTitle}</h2>
      <p className="text-sm text-zinc-400 leading-relaxed">{t.interiorsLead}</p>
      <a
        href={href}
        className="inline-block mt-3 text-sm font-semibold text-blue-400 hover:text-blue-300"
      >
        {matched ? t.interiorsCtaBuilding(name) : t.interiorsCtaHome}
      </a>
    </section>
  );
}
