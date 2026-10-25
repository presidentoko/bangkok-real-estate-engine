/**
 * How many fact tokens a condo <title> may carry after the building name.
 *
 * Measured on the 2026-10-25 GSC export (90 days): condo pages are 87% of
 * the site's impressions and every one of them comes from a building-name
 * query, so the name and district must survive truncation. Google renders
 * roughly 580px of title; "Thippharoek Condominium, Bang Phlat — $2,140/sqm
 * · 1 Listings · Flood L4/5 | RealData" is already past it, and the token
 * that gets cut is always the brand.
 *
 * Two is what still fits beside a median Thai building name. The order the
 * dictionaries push them in is the priority order, and the same export
 * settles it: counted over its 603 queries, the modifier searchers attach
 * to a building name is the price, never the yield.
 *
 *     price   (price / ราคา / 시세 / cost)      5 queries   24 impressions
 *     sale    (for sale / ขาย / buy)           9 queries   45 impressions
 *     review  (review / รีวิว)                 4 queries   12 impressions
 *     yield   (yield / ผลตอบแทน / 수익률)       0 queries    0 impressions
 *
 * Flood looks like a near-miss at 25 impressions, but every one of those is
 * a generic map query ("bangkok flood map") landing on /flood, not on a
 * building — so a flood level in a condo title earns nothing and was, until
 * now, the only fact 11,853 of our titles had. Price leads, listings second,
 * and yield and flood fall back to the description.
 */
export const TITLE_FACTS = 2;
