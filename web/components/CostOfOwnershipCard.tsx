type Props = {
  camFeePerMonth: number | null;
  sinkingFund: number | null;
  ownership: string | null;
  avgMonthlyRent: number | null;
};

function fmtTHB(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(2)}M`;
  return `฿${Math.round(v).toLocaleString()}`;
}

/**
 * Cost-of-ownership card — surfaces FazWaz-extracted CAM fee + sinking fund
 * + ownership category. Hidden when none of these are known.
 *
 * When we know both CAM and avg monthly rent, we show the "rent eaten by
 * CAM" ratio — a number nobody else surfaces but every owner-occupier or
 * landlord cares about.
 */
export function CostOfOwnershipCard({
  camFeePerMonth,
  sinkingFund,
  ownership,
  avgMonthlyRent,
}: Props) {
  if (camFeePerMonth == null && sinkingFund == null && !ownership) return null;

  const camRentRatio =
    camFeePerMonth != null && avgMonthlyRent != null && avgMonthlyRent > 0
      ? (camFeePerMonth / avgMonthlyRent) * 100
      : null;

  const foreignBadge = ownership?.toLowerCase().includes("foreign");

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Cost of ownership
        </h2>
        {ownership && (
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              foreignBadge
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-300"
            }`}
          >
            {ownership}
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            CAM fee
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtTHB(camFeePerMonth)}
            {camFeePerMonth != null && (
              <span className="text-sm text-zinc-500 font-normal">/mo</span>
            )}
          </div>
          {camRentRatio != null && (
            <div
              className={`text-xs mt-1 ${
                camRentRatio < 15
                  ? "text-emerald-400"
                  : camRentRatio < 25
                    ? "text-zinc-400"
                    : "text-rose-400"
              }`}
            >
              {camRentRatio.toFixed(1)}% of avg rent
            </div>
          )}
        </div>

        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Sinking fund
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {fmtTHB(sinkingFund)}
          </div>
          <div className="text-zinc-500 text-xs">one-time at purchase</div>
        </div>

        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Annual carry
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {camFeePerMonth != null
              ? fmtTHB(camFeePerMonth * 12)
              : "—"}
          </div>
          <div className="text-zinc-500 text-xs">CAM × 12 (excl. tax)</div>
        </div>
      </div>

      <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
        CAM fee covers the building&apos;s shared maintenance (lobby, pool,
        cleaning). It directly reduces net rental yield — a high CAM
        relative to rent is a hidden killer.
        {foreignBadge && (
          <>
            {" "}This building permits foreign-quota purchases. Confirm
            individual unit quota at the sales office before signing.
          </>
        )}
      </p>
    </section>
  );
}
