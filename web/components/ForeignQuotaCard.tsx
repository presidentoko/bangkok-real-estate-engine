type Props = {
  foreignListings: number | null;
  thaiListings: number | null;
  totalListings: number | null;
  foreignPct: number | null;
  fetchedAt: string | null;
};

function tone(pct: number | null): {
  text: string;
  className: string;
} {
  if (pct == null) return { text: "—", className: "text-zinc-400 bg-zinc-800 border-zinc-700" };
  if (pct >= 60) return { text: "Plenty available",       className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
  if (pct >= 30) return { text: "Mixed inventory",        className: "text-yellow-300  bg-yellow-500/10  border-yellow-500/30"  };
  if (pct >= 10) return { text: "Foreign quota tight",    className: "text-orange-400  bg-orange-500/10  border-orange-500/30"  };
  return            { text: "Almost no foreign quota",    className: "text-rose-400    bg-rose-500/10    border-rose-500/30"    };
}

/**
 * Foreign-Quota Inventory card.
 *
 * Thai condos have a 49%-foreign-ownership cap (the rest is "Thai Quota").
 * For a foreign buyer the actionable question is: how much foreign-quota
 * inventory is currently for sale in this building? High % = easy entry;
 * low % = need to act fast or settle for leasehold.
 *
 * We don't track sold-vs-allocated quota (that requires the developer's
 * sales-office data), but we do count Foreign vs Thai Quota labels among
 * currently-listed units — a strong proxy.
 */
export function ForeignQuotaCard({
  foreignListings,
  thaiListings,
  totalListings,
  foreignPct,
  fetchedAt,
}: Props) {
  if (foreignListings == null && thaiListings == null) return null;
  if ((foreignListings ?? 0) + (thaiListings ?? 0) === 0) return null;

  const label = tone(foreignPct);

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300">
          Foreign-quota inventory
        </h2>
        {fetchedAt && (
          <span className="text-xs text-zinc-500">
            as of {fetchedAt.slice(0, 10)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-4">
        <div>
          <div className="text-4xl font-bold tabular-nums">
            {foreignPct != null ? `${foreignPct.toFixed(0)}%` : "—"}
          </div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
            foreign of for-sale
          </div>
        </div>

        <div
          className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${label.className}`}
        >
          {label.text}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Foreign Quota
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-300">
            {foreignListings ?? 0}
          </div>
          <div className="text-zinc-500 text-xs">units on sale</div>
        </div>
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Thai Quota
          </div>
          <div className="text-2xl font-bold tabular-nums text-zinc-300">
            {thaiListings ?? 0}
          </div>
          <div className="text-zinc-500 text-xs">units on sale</div>
        </div>
        <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Total observed
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {totalListings ?? 0}
          </div>
          <div className="text-zinc-500 text-xs">listings on FazWaz</div>
        </div>
      </div>

      <p className="text-zinc-500 text-xs mt-4 leading-relaxed">
        Thai law caps foreign ownership at 49% per condominium. We count how
        many currently-listed units carry a &quot;Foreign Quota&quot; vs
        &quot;Thai Quota&quot; tag on FazWaz. High share = easy foreign entry;
        low share = act fast or consider leasehold. Sold quota is not visible
        — confirm individual unit eligibility at the sales office before
        signing.
      </p>
    </section>
  );
}
