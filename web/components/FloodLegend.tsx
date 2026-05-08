import { FLOOD_COLORS, FLOOD_DESCRIPTORS, type FloodLevel } from "@/lib/floodColors";
import { getDictionary } from "@/lib/getDictionary";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n";

const LEVELS: FloodLevel[] = [5, 4, 3, 2, 1];

export function FloodLegend({ lang }: { lang?: string }) {
  const useLang: Lang = lang && isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDictionary(useLang);
  return (
    <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl p-4 text-xs space-y-2 max-w-xs">
      <div className="font-semibold text-zinc-200 mb-1">{t.floodLegend.title}</div>
      {LEVELS.map((lv) => (
        <div key={lv} className="flex items-center gap-2">
          <span
            className="inline-block w-4 h-4 rounded shrink-0"
            style={{ backgroundColor: FLOOD_COLORS[lv] }}
          />
          <span className="text-zinc-300">
            <span className="font-mono text-zinc-500">L{lv}</span>{" "}
            {t.floodLegend.descriptors[lv] ?? FLOOD_DESCRIPTORS[lv]}
          </span>
        </div>
      ))}
      <div className="pt-2 border-t border-zinc-800 text-[10px] text-zinc-500 leading-snug">
        {t.floodLegend.footnote}
      </div>
    </div>
  );
}
