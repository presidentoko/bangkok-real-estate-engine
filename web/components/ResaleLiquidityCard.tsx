type Props = {
  score: number | null;
  grade: string | null;
  absorptionRate: number | null;
  medianSoldDom: number | null;
  sampleSize: number | null;
};

const GRADE_LABEL: Record<string, string> = {
  high: "Highly liquid",
  good: "Liquid",
  moderate: "Moderate",
  slow: "Slow to sell",
  illiquid: "Illiquid",
};

function tone(score: number) {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-lime-400";
  if (score >= 35) return "text-amber-400";
  if (score >= 20) return "text-orange-400";
  return "text-rose-400";
}

/**
 * Resale Liquidity Score — the answer to "if I buy here, can I get my money
 * back out?", a question no listing portal touches. We can answer it because we
 * track when each listing first appeared and the moment it disappears, so we
 * know how much of a building's supply actually clears and how fast.
 *
 * Hidden when we don't yet have enough listing history to judge (score=null) —
 * a misleading number is worse than none.
 */
export function ResaleLiquidityCard({
  score,
  grade,
  absorptionRate,
  medianSoldDom,
  sampleSize,
}: Props) {
  if (score == null) return null;

  const label = (grade && GRADE_LABEL[grade]) || "—";

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Resale liquidity
        </h2>
        <span className="text-xs text-zinc-500">
          can I sell this again?
        </span>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <div className={`text-4xl font-bold tabular-nums ${tone(score)}`}>
          {score.toFixed(0)}
          <span className="text-lg text-zinc-600 font-normal">/100</span>
        </div>
        <div className={`text-sm font-semibold mb-1 ${tone(score)}`}>
          {label}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <dt className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
            Absorption
          </dt>
          <dd className="text-zinc-100 font-semibold tabular-nums">
            {absorptionRate != null ? `${absorptionRate.toFixed(0)}%` : "—"}
          </dd>
          <dd className="text-zinc-500 text-xs">of supply cleared</dd>
        </div>
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <dt className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
            Time to sell
          </dt>
          <dd className="text-zinc-100 font-semibold tabular-nums">
            {medianSoldDom != null ? `~${medianSoldDom}d` : "—"}
          </dd>
          <dd className="text-zinc-500 text-xs">median, when sold</dd>
        </div>
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <dt className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
            Based on
          </dt>
          <dd className="text-zinc-100 font-semibold tabular-nums">
            {sampleSize ?? "—"}
          </dd>
          <dd className="text-zinc-500 text-xs">listings tracked</dd>
        </div>
      </dl>

      <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
        We compute this from how much of this building&apos;s for-sale supply
        actually clears the market and how fast — tracking every listing from
        the day it appears to the day it disappears. A higher score means units
        here tend to find buyers; a low score warns that your exit could be
        slow. This is an availability signal, not a guarantee of sale price.
        {sampleSize != null && sampleSize < 8 && (
          <> Sample is still small, so treat this as an early read.</>
        )}
      </p>
    </section>
  );
}
