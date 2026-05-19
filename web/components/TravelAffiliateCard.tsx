import { tripUrl } from "@/lib/affiliates";

type Props = {
  /** Placement identifier — flows to Trip.com `trip_sub1` for attribution. */
  surface: string;
  /** Destination noun shown to the reader ("Bangkok", "this building", "Phuket"). */
  destination: string;
  /**
   * Optional context line — replaces the default ("Planning a viewing
   * trip?"). Use for blog posts or condo pages where a tighter framing
   * fits better.
   */
  framing?: string;
  /** Optional CTA override. Defaults to "Find flights + hotels →". */
  ctaText?: string;
};

/**
 * Compact affiliate card for travel booking. Sized to slot in next to
 * the lead-capture CTA without competing for the primary action — this
 * isn't the conversion path, it's a secondary monetisation surface for
 * readers who weren't going to fill the broker-referral form anyway.
 *
 * Google's affiliate-link guidance:
 * - rel="sponsored" → tells the crawler this is paid placement, doesn't
 *   nuke the rest of the page's PageRank.
 * - rel="noopener" → security hardening on target=_blank.
 * - visible disclosure → the small "affiliate" line at the bottom.
 */
export function TravelAffiliateCard({
  surface,
  destination,
  framing,
  ctaText = "Find flights + hotels →",
}: Props) {
  const lead =
    framing ??
    `Planning a viewing trip to ${destination}? Compare flights and hotels in one search.`;
  return (
    <aside className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-2">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">
        Travel partner
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed">{lead}</p>
      <a
        href={tripUrl(surface)}
        target="_blank"
        rel="sponsored noopener nofollow"
        className="inline-block bg-sky-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-sky-400 transition shadow-lg shadow-sky-500/20"
      >
        {ctaText}
      </a>
      <p className="text-[11px] text-zinc-600 leading-snug">
        Affiliate link — Trip.com pays us a small commission if you book,
        you pay nothing extra. No editorial influence on the data above.
      </p>
    </aside>
  );
}
