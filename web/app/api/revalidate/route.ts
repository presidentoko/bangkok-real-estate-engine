import { revalidatePath, revalidateTag } from "next/cache";

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
 * So the page's own revalidate went to 30 days and freshness arrived here
 * instead, from a weekly script. Since 2026-09-15 condo pages are static
 * HTML on Cloudflare (.github/workflows/condo-static.yml) and nothing calls
 * this for them; it stays for revalidating any other path by hand.
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

  const raw = (body as { paths?: unknown })?.paths ?? [];
  const rawTags = (body as { tags?: unknown })?.tags ?? [];
  if (!Array.isArray(raw) || !Array.isArray(rawTags)) {
    return Response.json({ error: "paths[] / tags[] must be arrays" }, { status: 400 });
  }

  // Only site paths, and only ones this endpoint is meant to touch. A stray
  // "/" here would rebuild the home page's 44KB map payload on every call;
  // the home page itself is allowed only as an exact /en, /ko or /th.
  // yield/flood/data/districts were added 2026-11-17: they aggregate the
  // whole catalogue and went stale for days after a data repair (audit H5).
  const allowed =
    /^\/(en|ko|th)(\/(condo|district|city|near|developer|retiree|best|yield|flood)\/.+|\/(yields|flood|data|districts|inventory))?$/;
  const paths = [...new Set(raw.filter((p): p is string => typeof p === "string"))]
    .filter((p) => allowed.test(p))
    .slice(0, MAX_PATHS);
  // Shared data caches (unstable_cache tags). "site-data" covers the yield
  // index, site stats and the per-area aggregates.
  const ALLOWED_TAGS = new Set(["site-data", "yields", "stats"]);
  const tags = [...new Set(rawTags.filter((t): t is string => typeof t === "string"))]
    .filter((t) => ALLOWED_TAGS.has(t));

  for (const t of tags) revalidateTag(t);
  for (const p of paths) revalidatePath(p);

  return Response.json({
    revalidated: paths.length,
    tags: tags.length,
    skipped: raw.length - paths.length + rawTags.length - tags.length,
  });
}
