import Link from "next/link";
import type { CondoSummary, PropertyType } from "@/lib/queries/condos";

// Plain <img> on purpose — hipcdn already serves 400x330 thumbnails, so the
// Vercel image pipeline would add cost without adding value.

const FLOOD_TINT: Record<number, string> = {
  5: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  4: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  3: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  2: "bg-lime-500/15 text-lime-300 ring-lime-500/30",
  1: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
};

// Apartments in Thailand are rental-only (no individual unit titles), so
// foreigners can't buy. Surface this loud-and-clear on every card so a viewer
// doesn't waste 5 minutes thinking they found a deal they can purchase.
const TYPE_BADGE: Record<PropertyType, { label: string; classes: string; title: string }> = {
  condo: {
    label: "Condo",
    classes: "bg-blue-500/20 text-blue-200 ring-blue-500/30",
    title: "Condominium — foreigner can own (49% per-project quota)",
  },
  apartment: {
    label: "Apartment · rent only",
    classes: "bg-purple-500/20 text-purple-200 ring-purple-500/30",
    title: "Rental-only building. No individual unit titles — can't be purchased.",
  },
  "serviced-apartment": {
    label: "Serviced · rent only",
    classes: "bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-500/30",
    title: "Hotel-style serviced rental. No individual titles.",
  },
};

function bubbleTint(b: number | null): string {
  if (b == null) return "bg-zinc-700/50 text-zinc-400 ring-zinc-600/40";
  if (b > 130) return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  if (b > 110) return "bg-orange-500/15 text-orange-300 ring-orange-500/30";
  if (b < 70) return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (b < 90) return "bg-lime-500/15 text-lime-300 ring-lime-500/30";
  return "bg-zinc-700/40 text-zinc-300 ring-zinc-600/40";
}

function bubbleArrow(b: number | null): string {
  if (b == null) return "·";
  if (b > 105) return "▲";
  if (b < 95) return "▼";
  return "·";
}

// Surface where the row originates. Hipflat is the trusted scoring source;
// other portals contribute listings (and standalone condos when nothing
// matched), so we mark them so a reader can see "this card came from
// DotProperty, not from our scored set."
const SOURCE_BADGE: Record<string, { label: string; classes: string; title: string } | null> = {
  hipflat: null, // canonical — no badge needed
  dotproperty: {
    label: "dotproperty",
    classes: "bg-cyan-500/15 text-cyan-200 ring-cyan-500/30",
    title: "Sourced from dotproperty.co.th — not yet cross-verified by RealData",
  },
  ddproperty: {
    label: "ddproperty",
    classes: "bg-violet-500/15 text-violet-200 ring-violet-500/30",
    title: "Sourced from ddproperty.com — not yet cross-verified by RealData",
  },
  fazwaz: {
    label: "fazwaz",
    classes: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    title: "Sourced from fazwaz.com — not yet cross-verified by RealData",
  },
};

export function BuildingCard({
  condo,
  hrefPrefix = "/condo/",
  size = "md",
}: {
  condo: CondoSummary;
  hrefPrefix?: string;
  size?: "sm" | "md";
}) {
  const above = condo.bubble_index != null ? Math.round(condo.bubble_index - 100) : null;
  const compact = size === "sm";
  const isRentalOnly = condo.property_type !== "condo";
  const typeBadge = TYPE_BADGE[condo.property_type] ?? TYPE_BADGE.condo;
  const sourceBadge = SOURCE_BADGE[condo.source] ?? null;
  const noScore = condo.bubble_index == null && !isRentalOnly;

  return (
    <Link
      href={`${hrefPrefix}${condo.slug ?? condo.id}`}
      className="group relative block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition"
    >
      <div className={`relative ${compact ? "aspect-[5/3]" : "aspect-[5/3]"} bg-zinc-950 overflow-hidden`}>
        {condo.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={condo.hero_image_url}
            alt={condo.name}
            loading="lazy"
            decoding="async"
            width={400}
            height={240}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-zinc-700 text-xs">
            no photo
          </div>
        )}
        {/* gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />

        {/* top-left: property type badge + (optional) source badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ring-1 backdrop-blur ${typeBadge.classes}`}
            title={typeBadge.title}
          >
            {typeBadge.label}
          </span>
          {sourceBadge && (
            <span
              className={`text-[9px] font-semibold lowercase tracking-wide rounded-full px-1.5 py-0.5 ring-1 backdrop-blur ${sourceBadge.classes}`}
              title={sourceBadge.title}
            >
              {sourceBadge.label}
            </span>
          )}
        </div>

        {/* top-right: signal badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {condo.is_super_value && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-emerald-950 rounded-full px-2 py-0.5">
              ★ Super Value
            </span>
          )}
          {condo.flood_risk_level != null && (
            <span
              className={`text-[10px] font-bold tabular-nums rounded-full px-2 py-0.5 ring-1 backdrop-blur ${FLOOD_TINT[condo.flood_risk_level] ?? "bg-zinc-700/50 text-zinc-300 ring-zinc-600/40"}`}
              title={`Flood Level ${condo.flood_risk_level}/5`}
            >
              🌊 L{condo.flood_risk_level}
            </span>
          )}
        </div>
        {/* name overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className={`font-bold text-zinc-50 leading-tight ${compact ? "text-sm" : "text-base"} drop-shadow line-clamp-2`}>
            {condo.name}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {condo.region ?? "—"}
            {condo.total_units != null && (
              <span className="text-zinc-600"> · {condo.total_units} units</span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 flex items-center justify-between gap-2">
        {isRentalOnly ? (
          // Rental-only: no Bubble Index (sale prices don't exist). Surface the
          // rent-side info instead and a small note about ownership status.
          <>
            <div className="flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Type</div>
              <div className="text-xs text-purple-300 font-medium">Rental only</div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Rent · median</div>
              <div className="text-sm text-zinc-300 tabular-nums">
                {condo.market_rent_median
                  ? `${condo.market_summary_currency ?? "USD"} ${Math.round(condo.market_rent_median).toLocaleString("en-US")}/mo`
                  : "—"}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Bubble</div>
              {noScore ? (
                <div
                  className="text-[11px] font-semibold text-zinc-500 px-2 py-0.5 rounded-md ring-1 ring-zinc-700/40 bg-zinc-800/40 inline-flex items-center gap-1"
                  title="No bubble score yet — this building was found on a portal but hasn't been cross-verified by RealData's scoring pipeline."
                >
                  no score
                </div>
              ) : (
                <div className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-md ring-1 inline-flex items-center gap-1 ${bubbleTint(condo.bubble_index)}`}>
                  <span>{bubbleArrow(condo.bubble_index)}</span>
                  <span>{above == null ? "—" : above > 0 ? `+${above}%` : `${above}%`}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {condo.market_sale_median ? "Sale" : condo.market_rent_median ? "Rent" : "—"}
              </div>
              <div className="text-sm text-zinc-300 tabular-nums">
                {condo.market_sale_median
                  ? `${condo.market_summary_currency ?? "USD"} ${Math.round(condo.market_sale_median).toLocaleString("en-US")}`
                  : condo.market_rent_median
                    ? `${condo.market_summary_currency ?? "USD"} ${Math.round(condo.market_rent_median).toLocaleString("en-US")}/mo`
                    : "—"}
              </div>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
