import { revalidatePath } from "next/cache";

/**
 * On-demand ISR revalidation for the pages whose data actually changed.
 *
 * condo/[slug] used to carry `revalidate = 604800`, which meant all ~46,000
 * of its URLs (15,485 published condos x 3 locales) rewrote themselves every
 * seven days whether or not anything about the building had changed. Most of
 * them never change: ~9,750 are noindex stubs with no listing, no price and
 * no description, and a scrape that finds nothing new leaves the rest
 * identical too. The bill for that on 2026-08-20 was 549K ISR writes against
 * a 200K allowance and 9.79GB of a 10GB Fast Origin Transfer cap.
 *
 * So the page's own revalidate is now 30 days and freshness arrives here
 * instead: scripts/revalidate_changed.py runs at the end of the weekly
 * refresh and POSTs the slugs whose price/listing data moved.
 *
 * Not a cron endpoint and not public — REVALIDATE_SECRET is required, and a
 * caller who guesses it can only make pages rebuild themselves, never read
 * or write data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One POST may not rebuild more of the catalogue than a weekly scrape could
 *  plausibly have touched. Anything larger is a bug or an abuse, and letting
 *  it through would recreate the exact write storm this endpoint exists to
 *  end. */
const MAX_PATHS = 6000;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }
  if (request.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const raw = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(raw)) {
    return Response.json({ error: "paths[] required" }, { status: 400 });
  }

  // Only site paths, and only ones this endpoint is meant to touch. A stray
  // "/" here would rebuild the home page's 44KB map payload on every call.
  const allowed = /^\/(en|ko|th)\/(condo|district|city|near|developer|retiree|best)\//;
  const paths = [...new Set(raw.filter((p): p is string => typeof p === "string"))]
    .filter((p) => allowed.test(p))
    .slice(0, MAX_PATHS);

  for (const p of paths) revalidatePath(p);

  return Response.json({ revalidated: paths.length, skipped: raw.length - paths.length });
}
