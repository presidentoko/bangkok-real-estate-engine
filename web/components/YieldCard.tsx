import type { CondoYield, MortgageRate } from "@/lib/queries/yield";

type Props = {
  yieldData: CondoYield | null;
  mortgageRate: MortgageRate | null;
  currency?: string;
};

function fmtThb(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(2)}M`;
  return `฿${Math.round(v).toLocaleString()}`;
}

/**
 * Per-condo gross-yield card with spread against current Thai MRR.
 *
 * Hides itself if we never computed yield for this condo (i.e. we don't
 * have matched sale+rent listings yet). When MRR isn't loaded (BOT data
 * missing), the spread row is skipped but yield itself still renders.
 */
export function YieldCard({ yieldData, mortgageRate }: Props) {
  if (!yieldData || yieldData.gross_yield_pct == null) return null;

  const y = yieldData;
  const mortgage = mortgageRate?.rate ?? null;
  const spread = mortgage != null ? y.gross_yield_pct! - mortgage : null;
  const spreadGood = spread != null && spread >= 0;

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Rental yield
        </h2>
        <span className="text-xs text-zinc-500">
          n={y.yield_sample_sale ?? 0} sale / {y.yield_sample_rent ?? 0} rent
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Gross yield
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {y.gross_yield_pct!.toFixed(2)}%
          </div>
          <div className="text-zinc-400 text-xs">
            annualized · before tax & vacancy
          </div>
        </div>

        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Avg sale price
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtThb(y.avg_sale_price)}
          </div>
        </div>

        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Avg monthly rent
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtThb(y.avg_monthly_rent)}
          </div>
        </div>
      </div>

      {spread != null && (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-sm">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-zinc-500 text-xs uppercase tracking-wider">
              vs. mortgage (MRR {mortgage!.toFixed(2)}%)
            </span>
            <span
              className={`text-lg font-semibold tabular-nums ${
                spreadGood ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {spread >= 0 ? "+" : ""}
              {spread.toFixed(2)}pp
            </span>
            <span className="text-zinc-500 text-xs">
              {spreadGood
                ? "yield exceeds the cost of mortgage money"
                : "yield is below the cost of mortgage money"}
            </span>
          </div>
          <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
            MRR (Minimum Retail Rate) is Thailand&apos;s benchmark mortgage
            rate, published by Bank of Thailand. We use the most recent
            month&apos;s mean of MRR Min and Max ({mortgageRate!.period.slice(0, 7)}).
          </p>
        </div>
      )}
    </section>
  );
}
