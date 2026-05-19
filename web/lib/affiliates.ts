/**
 * Affiliate link configuration.
 *
 * Building the URL through a helper (not hardcoded into JSX) keeps
 * partner IDs in one place and lets every placement tag a unique
 * `trip_sub1` so we can see in the partner dashboard which surface
 * actually drives conversions.
 *
 * All affiliate placements must:
 * - render with `rel="sponsored noopener nofollow"` (Google's guidance)
 * - carry a visible disclosure ("affiliate link — pay nothing extra")
 * - not stack with the broker-referral lead capture (don't double-monetise)
 */

const TRIP_BASE = "https://www.trip.com/";
const TRIP_PARAMS = {
  Allianceid: "8250663",
  SID: "313031699",
  trip_sub3: "D17154748",
};

/**
 * Build a Trip.com affiliate URL with a placement-specific sub1 tag.
 * @param sub1 — short kebab-case identifier of the surface (e.g.
 *   "city-bangkok", "condo-page", "blog-phuket-bubble"). Read on the
 *   partner dashboard to attribute conversions.
 */
export function tripUrl(sub1: string): string {
  const params = new URLSearchParams({
    ...TRIP_PARAMS,
    trip_sub1: sub1,
  });
  return `${TRIP_BASE}?${params.toString()}`;
}
