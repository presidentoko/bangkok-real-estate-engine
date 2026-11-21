# Supabase egress cut (2026-11-19, branch `egress-cut`, nothing pushed or deployed)

No Supabase query was made. All byte figures are **inferred** from selected columns, schema and counts quoted in the 11-17 audit (15,645 condos_published rows, 53.5k active listings, ~16k risk_factors, ~6.8k value_scores). No live row sizes were measured, so treat every number as +/-50%. The 5.72 GB period total is the only measured figure.

## A. Egress map (before the changes)

Assumptions: ~30 commits in the period, so ~30 Vercel builds (1 per commit; previews unknown). Every build prerenders each static/`generateStaticParams` route in 3 locales. Row sizes: id uuid 36 B, JSON key overhead included.

| Rank | Source (file:line) | Bytes per call | Frequency | Est. GB/month | Confidence |
|---|---|---|---|---|---|
| 1 | Vercel build-time prerender of pages with uncached direct queries: `blog/bangkok-flood-risky-popular/page.tsx` (3 table scans, ~5 MB x3 locales), `data/page.tsx` (~1.7 MB x3), `districts/page.tsx` fetchDistricts (~1.7 MB x3), `developer/page.tsx` fetchDevelopers (~2 MB x3), `district/[slug]` rows (~4.4 MB x3 over all districts), `developer/[slug]` rows (~2.8 MB x3), `sitemap-condos/[page]` (3 pages, ~6 MB with descriptions), `sitemap-areas.xml` (~1.9 MB), `llms.txt` (~1.2 MB), corridor blog (~0.8 MB x3) | ~65 MB per build | every deploy (~30) | **~1.9 (0.7-2.5)** | medium-low: depends on builds not reusing the Data Cache |
| 2 | Same pages on runtime ISR (`revalidate = 86400`, all 3 locales) plus daily `unstable_cache` of city feed / map points / provinces (`lib/queries/condos.ts:202,230,362`, ~8 MB/day) and sitemap-condos daily | ~10-25 MB/day | daily | **~1.0 (0.4-1.2)** | medium |
| 3 | Cloudflare condo export, `app/(site)/[lang]/condo/[slug]/page.tsx` (~9 reads per page x 3 locales: full row, listings x2 (metadata + body), chart, amenities, parking, neighbours, yield, developer); `.github/workflows/condo-static.yml`, `scripts/condo_static/plan.py` | ~20-45 KB per page | weekly changed run (~2,250 pages) + ad-hoc indexable/ids/full runs. 11-17: 7,521 + ~5,500 + 885 pages | **~0.9** in a month like this one (weekly ~0.25, 11-17 ~0.5) | medium |
| 4 | Python batch: `weekly-refresh.yml` (snapshot_prices, compute_yields, compute_value_scores, liquidity, risk, super_value `select("*")`, cleanup, rematch, slug backfill, sweeps whose `upsert_*_condo` return the full row), `daily-ingest.yml` (snapshot + yields + ingest, Wed) | 80-200 MB/weekly run, 20-30 MB mid-week | weekly + Wed | **~0.5 (0.3-0.9)** | low |
| 5 | Audit dumps and my analysis sessions on 11-17..11-19 (15,645 condos_published rows, yield rows, page sampling) | one-off | ad hoc | ~0.2-0.4 | low |
| 6 | `/api/*` (inventory/compare/search/yields have CDN `s-maxage`; `ask`, `batch` limited), `<Link>` prefetch (none set explicitly; prefetched pages are ISR hits), rss (limit 15) | small | per request | <0.1 | medium |

Cross-check with the graph: 11-17 had 7 commits (7 builds ~0.45 GB) + export passes (~0.5 GB) + audit dumps (~0.15-0.3 GB) = 1.1-1.25 GB, which matches the 1.2 GB spike. That is the best evidence for ranks 1 and 3, but it is a coincidence-level match, not proof.

Findings that were not the problem: select("*") is rare in web code (`alerts/page.tsx:45`, `api/promotions` - both small, limited); most large reads were already narrowed and compacted. No unbounded query found in web code; every scan paginates.

## B. What changed (7 commits on `egress-cut`)

| Commit | Change | Est. saving GB/month |
|---|---|---|
| `4e93e16` | `sitemap.xml`, `sitemap-condos`, `sitemap-areas.xml`, `llms.txt` throw on a Supabase error instead of caching empty output (the diagnosis diff, extended). Dropped unused `id` from the `regions -> condos(...)` embed in sitemap-areas and llms (~45% of ~1.2 MB each) | 0.05 (the real value is no more poisoned caches) |
| `c4e6891` | Condo page: one shared listings read for metadata + body (removes the `ownRows` query, also on Vercel). Static export only: `lib/exportMemo.ts` keeps each building's reads for its 2nd and 3rd locale (memory + shared temp dir). `plan.py` orders pages slug-first so locales are adjacent. `condo-static.yml`: build step env `CONDO_STATIC_DATA_CACHE` (schedule untouched). Tests: `exportMemo.test.ts`, `tests/test_condo_static_plan.py` | 0.15 in a quiet month, 0.5-0.7 in a month with full/indexable passes |
| `9585561` | `unstable_cache` (7 d, tag `site-data`, throws on error) for the flood blog scans, corridor blog and `/data` showcase | 0.5-0.9 (rank 1+2 share) |
| `d26cb4e` | Same for districts index, developers index, per-district rows, per-developer rows | 0.3-0.5 |
| `1b69d5c` | sitemap-condos no longer downloads `description` for rows that pass on listings/price/yield (descriptions fetched only for description-only candidates, chunked `.in`). Same predicate, test added. `revalidate` 86400 -> 604800 for sitemap.xml, sitemap-condos, sitemap-areas, llms.txt | 0.2-0.4 |
| `ff2a04f` | City feed, map points, provinces: `unstable_cache` 1 d -> 7 d, tag `site-data` added so the weekly revalidate refreshes them | 0.15-0.2 |
| `3f58d4d` | `super_value.py`: 3 x `select("*")` -> 3 columns | ~0.04 |

**Estimated total saving: ~2.0-3.0 GB/month (mid ~2.5), i.e. 45-50% of the 5.7 GB.** Expected steady state afterwards: **~1.5-2.5 GB/month** (about 50-80 MB/day) if the rank-1 hypothesis holds. If builds do not hit the Data Cache, the wrapped pages still read once per build instead of three times, so the saving drops to roughly 1.5 GB.

Tests/checks: web `node --test lib/*.test.ts` 57 pass; `pytest tests` 45 + 3 pass; `tsc --noEmit` clean except two stale `.next/types` errors for the deleted `/reality` route (from an old `.next`, pre-existing). `next build`: **compiles successfully, then fails at "collect page data"** because the yield/fee indexes need Supabase (run with a dead local URL, never the real project). Build therefore cannot be verified offline; do it after Supabase is back.

## C. NOT changed, and why

- Yield index cache (`lib/queries/yieldAreas.ts:57`, 86400) and yield page revalidate: kept. It reads ~0.4 MB/day (~12 MB/month); lengthening it re-opens the stale-/yield contradiction (audit H5) and depends on the unverified `REVALIDATE_SECRET`. Flood/fees pages were already 604800.
- `generateStaticParams` of `district` (`regions(name, condos(id))`, ~0.8 MB per build) and `developer` (~0.6 MB): a `condos(count)` embed would fix it but I cannot test PostgREST behaviour offline. Candidate follow-up.
- `plan.py --mode indexable` still reads `description` for all rows (~5-8 MB per run); needs a filtered query I cannot test.
- Python ingest `upsert_*_condo` return the whole condos row (`src/db.py` ~l.300, 430, 520, 578). supabase-py cannot restrict the returned columns here; unknown volume (10-60 MB/week). Needs a test against a dev DB.
- `compute_*`, `liquidity`, `snapshot_prices`: already column-narrow; reduction would need SQL aggregates/RPC (DB changes, forbidden now).
- No workflow schedule edited. Suggestions: `daily-ingest.yml` (Wed) repeats snapshot + compute_yields that the Sunday run does again; drop them from Wed if the mid-week yield freshness is not needed (~30-60 MB/week). Run `condo-static` `full` only when a template changes; prefer `ids`.
- Edge case not handled: Vercel cannot be told to prerender fewer pages; keep commits to `main` batched (each = a build).

## D. Risks

- Pages that I wrapped now **throw** when Supabase fails. In an outage a build fails (or ISR keeps the old page) instead of publishing empty content. Do not deploy while Supabase is 402.
- Freshness: wrapped data is up to 7 d old, refreshed by the weekly job's `site-data` tag only if the GitHub secret `REVALIDATE_SECRET` exists (unverified). Without it data lags up to 7 days.
- Unstable_cache entries are cold after deploy: the first build/requests after Supabase returns pay once (~20 MB).
- Export memo: disk cache lives in `runner.temp`, per job; local builds do not set it, so they never serve old rows.
- Unverified: sitemap description fetch uses `.in("id", <=100 ids)`; check the sitemap total URL count equals pre-change (diagnosis item 3-4).

## E. Deploy checklist (after Supabase is back)

1. Supabase answers 200 on a one-row read. Note the usage page figure for the day (baseline).
2. Review/merge `egress-cut`; deploy once (one build, not several).
3. Check `/sitemap.xml`, `/sitemap-condos/0.xml` (non-empty; total URLs = passing x 3), `/llms.txt`, `/en/data`, `/en/blog/bangkok-flood-risky-popular`, `/en/districts`, `/en/developer`, a district and a developer page, `/en/inventory`. Purge Cloudflare for the sitemap URLs.
4. Verify `REVALIDATE_SECRET` is set in GitHub Actions.
5. Next export: `ids` or `changed` mode first; confirm the build log has fewer Supabase round trips. Then watch usage.
6. Verify egress: Supabase Dashboard -> Settings -> Usage -> Egress, daily bars. Expect day-of-deploy <=250 MB (cold caches), then 30-100 MB/day. A bar >250 MB means a regression: compare against that day's workflow runs/deploys.
7. Weekly Sunday: expect one bump (scrapers + export) of 100-250 MB.

**Daily budget:** 5 GB / 30 = 166 MB/day mean; target <=100 MB/day sustained, alert at 250 MB, hard rule: any manual dump or `full`/`indexable` export must be scheduled in advance and cost-estimated (full export ~0.25 GB after memo; select only needed columns in audits).

## F. Is Pro needed?

Probably not for steady state if the estimates hold (1.5-2.5 GB/month against 5 GB), but the margin is thin for a month with a full export plus audit dumps (+0.5-1 GB) and catalogue growth (~1,400 buildings/month). Because exceeding the quota disables the whole project (as seen, HTTP 402 broke the live sitemap), Pro ($25/mo, 250 GB) is cheap insurance; decide after one week of measured daily egress post-deploy. If the daily average is above ~120 MB, take Pro.

## Deployed 2026-11-21

- Supabase answered 200 on a one-row read before and after the deploy. Own usage in this task: a few one-row reads and three head counts (well under 1 MB), plus one `next build` (reads Supabase for yield/fee indexes and page data) and one Vercel build.
- Checks before merge: web tsc clean, web tests 57 pass, pytest tests 45 pass (not 48: the "+3" in section B is not under `tests/`; scripts/test_*.py are probes, not pytest tests). `next build` compiled and generated 1,669 pages (exit 0). Note `npm run build` fails on Windows (bin shim), run `node node_modules/next/dist/bin/next build`.
- `egress-cut` fast-forwarded into `main` (024ca06), pushed as presidentoko, account switched back to dynamitenaa-cloud.
- Vercel did NOT build 024ca06: "Canceled by Ignored Build Step" (the tip only touched data/audits). Added `07ddcd5` (one comment line in web/app/sitemap.xml/route.ts) to trigger the build. Main is now at `07ddcd5`. Vercel status: success ("Deployment has completed"), about 12 min. Lesson: the ignored build step only looks at the tip commit; do not end a web deploy with a docs-only commit.
- Sitemaps (Googlebot UA, cache-busted): sitemap.xml lists static, areas, condos/0, condos/1. condos/0.xml: 2,350 buildings = 7,050 URLs; condos/1.xml: 157 buildings = 471 URLs; condos/2..5.xml: empty 200. Total 7,521 URLs = 2,507 buildings x 3 languages (matches the 7,521 pages of the 11-17 indexable export).
- Cloudflare: not purged (no token locally). Without a cache-buster, /sitemap.xml still returned the old 2-entry copy from Cloudflare (cf-cache-status HIT, Age ~1000 s, Cache-Control: public with no max-age). condos/0 and /1 were already fresh. Needs a Cloudflare purge of https://passionaryestate.com/sitemap.xml or it expires on its own.
- Spot checks (en/ko/th): home, /flood (371 buildings, 29%, of 1,296 in the high-risk sentence; 51 table rows), /yield/bangkok (5.4% median of 881), /fees/bangkok (฿2,090/month), /data, /en/districts, a district (pattaya), a developer page, 3 condo pages: all 200, 0 NaN, 0 undefined, tables populated. /en/reality/anything: 410. rss.xml (7 items), robots.txt (sitemap line present) fine.
- PROBLEM: /llms.txt is 200 but shows "0 condo buildings / 0 listings / 0 districts / 0 yields". During the build the count queries failed (empty error message) and the route's catch block rendered the zero fallback, which is now cached for 7 days (revalidate = 604800). Likely cause: the exact count of active listings takes about 8 s (66,441 rows) and times out when the build runs many queries at once. Fix proposed, not applied: do not cache the fallback (return it with no-store or throw at runtime), and use a cheaper count for listings (planned/estimated, or a per-region sum). Until then llms.txt can only be refreshed by a new deploy.
- REVALIDATE_SECRET: exists in local .env; the GitHub secret was not checked (gh auth switch not used for secrets). /api/revalidate only allows page paths and the tags site-data/yields/stats, so it cannot refresh sitemap routes or llms.txt.
