/**
 * What counts as an "active" listing in the site's headline numbers.
 *
 * dotproperty / ddproperty / fazwaz rows are deactivated by
 * scripts/mark_stale_listings.py after 21 days unseen. hipflat rows are only
 * deactivated when the Tier B crawler revisits their building, so a building
 * it has not revisited keeps them active indefinitely: on 2026-11-17, 15,201
 * of 66,441 "active listings" were hipflat rows last seen in August (data
 * audit M7). Counts leave hipflat rows older than HIPFLAT_ACTIVE_DAYS out.
 *
 * The rows themselves stay is_active (they still feed the building yields;
 * see the note in scripts/mark_stale_listings.py), so this is a count rule,
 * applied as a PostgREST `or` filter next to `.eq("is_active", true)`.
 */
export const HIPFLAT_ACTIVE_DAYS = 30;

/** `or=(...)` filter body: not hipflat, or seen within the window. The cutoff
 *  is rounded to the day so cached queries do not get a new key per request. */
export function activeListingsOrFilter(now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - HIPFLAT_ACTIVE_DAYS * 86_400_000);
  const day = cutoff.toISOString().slice(0, 10);
  return `source.neq.hipflat,last_seen_at.gte.${day}T00:00:00Z`;
}
