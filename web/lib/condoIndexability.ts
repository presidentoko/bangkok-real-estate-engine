/**
 * Which condo pages are worth putting in front of Google.
 *
 * Measured 2026-08-17 against the live table: 14,071 published condos have a
 * slug, and therefore 42,213 URLs (x3 locales) were being submitted in
 * sitemap-condos.xml. Only 4,319 of those buildings carry any substantive
 * data at all — the other ~9,750 render as a name, a province, and a set of
 * empty cards.
 *
 * Search Console's verdict on that surface, same day:
 *
 *     Discovered - currently not indexed   25,678
 *     Crawled - currently not indexed       2,052
 *                                          ------
 *                                          27,730   ~= 9,750 x 3 locales
 *
 * That is not a coincidence, and it is not a crawl-rate problem Google will
 * grow out of: the stubs *are* the site as far as a crawler can tell, and
 * a domain that is 70% empty pages gets crawled and trusted accordingly.
 * Impressions fell from ~500/day to ~15/day on 2026-07-15 and stayed there
 * while this surface kept growing (the sitemap throttle that had been
 * hiding two-thirds of it expired 2026-08-04; "not indexed" jumped from
 * 21,080 to 39,555 the following day).
 *
 * So: a building is indexable when we can say something about it that the
 * portal listing itself doesn't already say. Anything below the bar still
 * renders, still resolves, and still passes link equity onward
 * (`follow`) — it just stops asking to be ranked.
 *
 * Deliberately NOT part of the bar: bubble_index, flood level, transit
 * distance. Those are derived from the district, not from the building, so
 * every condo in the district shares them — they cannot make a page unique.
 * Including them raised the pass rate to 9,761, which defeats the purpose.
 */

export type IndexabilitySignals = {
  active_listings_count?: number | null;
  market_sale_median?: number | null;
  market_rent_median?: number | null;
  gross_yield_pct?: number | null;
  description?: string | null;
  google_review_count?: number | null;
};

/** Columns hasIndexableSubstance() reads — keep SELECTs and this in sync. */
export const INDEXABILITY_SELECT =
  "active_listings_count, market_sale_median, market_rent_median, " +
  "gross_yield_pct, description, google_review_count";

/**
 * Coarse PostgREST pre-filter for the same rule, so callers that only need
 * the passing rows don't download the other 10k. It is deliberately looser
 * than hasIndexableSubstance() (it can't measure description length), so
 * always run the predicate over what comes back.
 */
export const INDEXABILITY_OR_FILTER = [
  "active_listings_count.gte.1",
  "market_sale_median.not.is.null",
  "market_rent_median.not.is.null",
  "gross_yield_pct.not.is.null",
  "description.not.is.null",
  "google_review_count.gte.3",
].join(",");

/** A description shorter than this is a scraped fragment, not content. */
const MIN_DESCRIPTION_CHARS = 120;

export function hasIndexableSubstance(c: IndexabilitySignals | null): boolean {
  if (!c) return false;
  if ((c.active_listings_count ?? 0) >= 1) return true;
  if (c.market_sale_median != null) return true;
  if (c.market_rent_median != null) return true;
  if (c.gross_yield_pct != null) return true;
  if ((c.description ?? "").trim().length >= MIN_DESCRIPTION_CHARS) return true;
  if ((c.google_review_count ?? 0) >= 3) return true;
  return false;
}
