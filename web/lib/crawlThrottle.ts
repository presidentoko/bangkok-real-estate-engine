// One deadline, imported by both middleware.ts (which serves the 503) and
// app/robots.ts (which advertises the block). They used to carry the fact
// separately, which is how you end up telling a crawler "Allow: /" and then
// refusing every request — repeated 503s read as an unstable origin and a
// crawler that backs off sitewide costs the pages we do want indexed.
//
// Why the block exists at all: the 2026-08-13 cycle hit 9.79GB of a 10GB
// Fast Origin Transfer cap on day 7 of 24. Hobby pauses the project rather
// than billing the overage. See middleware.ts for the full accounting.
//
// SELF-EXPIRING. Once this date passes, delete the constant and both call
// sites rather than pushing the date out. robots.ts revalidates daily so it
// follows within 24h without a deploy.
export const CRAWL_THROTTLE_UNTIL = Date.parse("2026-09-13T00:00:00Z");

export function condoCrawlThrottled(now: number = Date.now()): boolean {
  return now < CRAWL_THROTTLE_UNTIL;
}
