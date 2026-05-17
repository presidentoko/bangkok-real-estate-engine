type PortalStat = {
  source: "hipflat" | "dotproperty" | "ddproperty" | "fazwaz";
  saleCount: number;
  rentCount: number;
  saleMedian: number | null;
  rentMedian: number | null;
};

import { fmtTHB } from "@/lib/fmt";

type Props = {
  stats: PortalStat[];
};

const SOURCE_LABEL: Record<PortalStat["source"], string> = {
  hipflat: "Hipflat",
  fazwaz: "FazWaz",
  dotproperty: "DotProperty",
  ddproperty: "DDProperty",
};

/**
 * Multi-portal price comparison — same condo across our 4 sources.
 *
 * Renders nothing if we only have listings from one source: a single-portal
 * comparison isn't informative. The whole point is showing where multiple
 * portals diverge or agree, which is something no single portal can do.
 */
export function MultiPortalCard({ stats }: Props) {
  const nonzero = stats.filter((s) => s.saleCount + s.rentCount > 0);
  if (nonzero.length < 2) return null;

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Cross-portal price comparison
        </h2>
        <span className="text-xs text-zinc-500">
          medians across {nonzero.length} portals
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="text-left py-2">Portal</th>
              <th className="text-right py-2">Sale median</th>
              <th className="text-right py-2 text-zinc-500">n</th>
              <th className="text-right py-2 pl-4">Rent median</th>
              <th className="text-right py-2 text-zinc-500">n</th>
            </tr>
          </thead>
          <tbody>
            {nonzero.map((s) => (
              <tr key={s.source} className="border-t border-zinc-800/50">
                <td className="py-2 text-zinc-200 font-medium">
                  {SOURCE_LABEL[s.source]}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {fmtTHB(s.saleMedian)}
                </td>
                <td className="py-2 text-right text-zinc-500 text-xs">
                  {s.saleCount}
                </td>
                <td className="py-2 text-right tabular-nums pl-4">
                  {s.rentMedian != null ? `${fmtTHB(s.rentMedian)}/mo` : "—"}
                </td>
                <td className="py-2 text-right text-zinc-500 text-xs">
                  {s.rentCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-500 text-xs mt-3 leading-relaxed">
        Different portals can list the same condo at meaningfully different
        prices — agents pad listings, sellers pull old stock, prices drift.
        When portals disagree by more than ~10%, the lower number is usually
        the more recent / motivated seller.
      </p>
    </section>
  );
}
