import { FLOOD_COLORS, FLOOD_DESCRIPTORS, type FloodLevel } from "@/lib/floodColors";
import { getDictionary } from "@/lib/getDictionary";
import { DEFAULT_LANG, isLang, type Lang } from "@/lib/i18n";

export type FloodStatsProps = {
  lang?: string;
  totalGeolocated: number;
  totalBuildings: number;
  byLevel: Record<number, number>;
  unmatched: number;
};

const ORDER: FloodLevel[] = [5, 4, 3, 2, 1];

export function FloodStats({
  lang,
  totalGeolocated,
  totalBuildings,
  byLevel,
  unmatched,
}: FloodStatsProps) {
  const useLang: Lang = lang && isLang(lang) ? lang : DEFAULT_LANG;
  const t = getDictionary(useLang);

  const danger = (byLevel[5] ?? 0) + (byLevel[4] ?? 0);
  const dangerPct =
    totalGeolocated > 0 ? Math.round((danger / totalGeolocated) * 100) : 0;
  const safe = (byLevel[1] ?? 0) + (byLevel[2] ?? 0);
  const safePct =
    totalGeolocated > 0 ? Math.round((safe / totalGeolocated) * 100) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
          {t.flood.statsHeader}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-black text-rose-400 tabular-nums">
            {danger.toLocaleString()}
          </span>
          <span className="text-zinc-300 text-sm">
            {t.flood.statsTotal} ({dangerPct}%)
          </span>
          <span className="text-rose-400 font-semibold">{t.flood.statsDanger}</span>
          <span className="text-zinc-500 text-xs">
            · {totalGeolocated.toLocaleString()}/
            {totalBuildings.toLocaleString()} {t.flood.statsTotal}
          </span>
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          {t.flood.statsHeaderInverse}{" "}
          <span className="text-emerald-400 font-semibold">
            {safe.toLocaleString()} ({safePct}%)
          </span>{" "}
          {t.flood.statsHeaderInverseEnd}
        </div>
      </div>

      <div className="space-y-1.5">
        {ORDER.map((lv) => {
          const n = byLevel[lv] ?? 0;
          const pct =
            totalGeolocated > 0 ? (n / totalGeolocated) * 100 : 0;
          return (
            <div key={lv} className="flex items-center gap-3 text-xs">
              <span
                className="inline-block w-3 h-3 rounded shrink-0"
                style={{ backgroundColor: FLOOD_COLORS[lv] }}
              />
              <span className="font-mono text-zinc-500 w-6">L{lv}</span>
              <span className="text-zinc-300 flex-1 truncate">
                {t.floodLegend.descriptors[lv] ?? FLOOD_DESCRIPTORS[lv]}
              </span>
              <span className="text-zinc-400 tabular-nums w-12 text-right">
                {n.toLocaleString()}
              </span>
              <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct.toFixed(1)}%`,
                    backgroundColor: FLOOD_COLORS[lv],
                  }}
                />
              </div>
              <span className="text-zinc-500 tabular-nums w-10 text-right">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
        {unmatched > 0 && (
          <div className="text-[10px] text-zinc-500 mt-2 pt-2 border-t border-zinc-800">
            {t.flood.statsUnmatched(unmatched)}
          </div>
        )}
      </div>
    </div>
  );
}
