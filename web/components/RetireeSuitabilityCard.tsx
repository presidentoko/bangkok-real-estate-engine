import type { RetireeScore } from "@/lib/retiree";

type Props = {
  result: RetireeScore | null;
  hospitals: number | null;
  aqi: number | null;
  supermarkets: number | null;
  nearestTransitM: number | null;
};

const GRADE_LABEL: Record<string, string> = {
  excellent: "Excellent for retirees",
  good: "Good for retirees",
  fair: "Fair for retirees",
  weak: "Less suited to retirees",
};

function tone(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-lime-400";
  if (score >= 35) return "text-amber-400";
  return "text-rose-400";
}

function bar(value: number) {
  if (value >= 75) return "bg-emerald-500/70";
  if (value >= 55) return "bg-lime-500/70";
  if (value >= 35) return "bg-amber-500/70";
  return "bg-rose-500/70";
}

/**
 * Retiree Suitability — frames a building for the retirement-visa buyer, a
 * large Thailand segment no portal speaks to. Built from healthcare proximity,
 * air quality, car-free transit and daily errands. Hidden when we can't judge.
 */
export function RetireeSuitabilityCard({
  result,
  hospitals,
  aqi,
  supermarkets,
  nearestTransitM,
}: Props) {
  if (!result) return null;

  const rows: Array<{ label: string; value: number; detail: string }> = [
    {
      label: "Healthcare",
      value: result.components.healthcare,
      detail:
        hospitals != null
          ? `${hospitals} hospital${hospitals === 1 ? "" : "s"}/clinic${hospitals === 1 ? "" : "s"} within 1km`
          : "—",
    },
    {
      label: "Air quality",
      value: result.components.air,
      detail: aqi != null ? `AQI ${aqi}` : "no reading",
    },
    {
      label: "Transit",
      value: result.components.transit,
      detail:
        nearestTransitM != null ? `${nearestTransitM}m to rail` : "no station nearby",
    },
    {
      label: "Daily errands",
      value: result.components.errands,
      detail:
        supermarkets != null
          ? `${supermarkets} supermarket${supermarkets === 1 ? "" : "s"} within 1km`
          : "—",
    },
  ];

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Retiree suitability
        </h2>
        <span className="text-xs text-zinc-500">good place to retire?</span>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div className={`text-4xl font-bold tabular-nums ${tone(result.score)}`}>
          {result.score.toFixed(0)}
          <span className="text-lg text-zinc-600 font-normal">/100</span>
        </div>
        <div className={`text-sm font-semibold mb-1 ${tone(result.score)}`}>
          {GRADE_LABEL[result.grade]}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            <div className="w-24 shrink-0 text-zinc-400">{r.label}</div>
            <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full ${bar(r.value)}`}
                style={{ width: `${Math.max(4, r.value)}%` }}
              />
            </div>
            <div className="w-44 shrink-0 text-right text-xs text-zinc-500 tabular-nums">
              {r.detail}
            </div>
          </div>
        ))}
      </div>

      <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
        A retirement-focused read on the location: weighted toward nearby
        healthcare and clean air, then car-free transit and daily errands.
        Thailand&apos;s retirement (O-A/O-X) visa buyers weigh these very
        differently from young investors — this score reflects their priorities.
        {result.confidence === "low" && (
          <> Air-quality data is unavailable here, so the score uses the other
          factors only.</>
        )}
      </p>
    </section>
  );
}
