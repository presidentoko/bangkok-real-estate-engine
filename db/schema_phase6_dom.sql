-- Phase 6: Days-on-Market tracking on listings.
-- Real differentiator vs hipflat (they don't expose first-listed date).
-- Apply via Supabase SQL editor. Idempotent.

-- 1. Track when we first saw each listing + when we last saw it active.
alter table listings
    add column if not exists first_seen_at timestamptz default now() not null,
    add column if not exists last_seen_at timestamptz default now() not null,
    add column if not exists is_active boolean default true not null;

-- 2. Backfill: best signal we have is `scraped_at` (when this row was last
--    written). Use it for both first/last so DOM starts at 0 today.
update listings
    set first_seen_at = scraped_at,
        last_seen_at = scraped_at
    where first_seen_at >= now() - interval '5 minutes';

-- 3. Replace the partial unique index with a full one so PostgREST's ON
--    CONFLICT (UPSERT) can resolve. NULL source_unit_id rows are treated
--    as distinct under the standard SQL NULL semantic, so legacy rows
--    without one still coexist.
drop index if exists listings_condo_unit_uniq;
create unique index if not exists listings_condo_unit_uniq
    on listings(condo_id, source, source_unit_id);

create index if not exists listings_active_idx on listings(is_active) where is_active = true;
create index if not exists listings_first_seen_idx on listings(first_seen_at);

-- 4b. recompute_condo_dom() (below) both aggregates active hipflat
--     listings by condo_id and anti-joins condos against that same set.
--     Neither query is served well by listings_active_idx alone (it still
--     has to filter every active row down to source = 'hipflat'), and this
--     scan is a likely contributor to the RPC's statement_timeout (57014)
--     failures observed daily since 2026-06-26. A covering partial index
--     on the exact predicate the function uses lets both the GROUP BY and
--     the antijoin use an index scan instead of a filtered seq scan.
create index if not exists listings_hipflat_active_condo_idx
    on listings(condo_id)
    where is_active = true and source = 'hipflat';

-- 4. Per-condo aggregate so the site can sort by listing freshness without
--    a heavy GROUP BY at request time.
alter table condos
    add column if not exists active_listings_count integer,
    add column if not exists median_listing_dom_days integer,
    add column if not exists max_listing_dom_days integer,
    add column if not exists dom_computed_at timestamptz;

-- 4a. Postgres pins a view's column list at creation time, so adding
--     columns to `condos` does not propagate to `condos_published`. Re-run
--     the view definition so the new DOM columns are queryable through it.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;

-- 5. Helper: recompute the per-condo DOM aggregates from currently-active
--    listings. Run after each Tier B pass, plus a daily tick (see
--    .github/workflows/daily-dom.yml) since the DOM values shift by +1 day
--    every run even without a new scrape.
--
--    This intentionally recomputes across ALL active hipflat listings every
--    call rather than only condos touched "recently" — DOM (days on
--    market) increases by one for every still-active listing every day
--    regardless of whether that listing was rescanned, so a
--    recency-scoped/incremental version would silently stop advancing DOM
--    for untouched-but-still-active listings and would change this
--    function's output contract (web/app/[lang]/condo/[slug]/page.tsx and
--    web/app/[lang]/stale/page.tsx both read median_listing_dom_days /
--    max_listing_dom_days expecting a true daily-fresh value for every
--    published condo). Kept as a full recompute; see the SET LOCAL
--    statement_timeout below and listings_hipflat_active_condo_idx above
--    for the actual timeout fix instead.
create or replace function recompute_condo_dom() returns void
language plpgsql as $$
begin
    -- The free-tier Supabase role-level statement_timeout is what's been
    -- canceling this RPC (postgrest.exceptions.APIError 57014) on every
    -- run since 2026-06-26. statement_timeout is a plain USERSET GUC, so a
    -- SET LOCAL here raises it for the remainder of this transaction only
    -- (scoped to this RPC call, not a global change) without needing
    -- direct database/role admin access. 55s leaves headroom under both
    -- callers' step timeouts (daily-dom.yml's 5-minute job timeout and the
    -- Tier B step in weekly-refresh.yml).
    set local statement_timeout = '55s';

    with agg as (
        select
            condo_id,
            count(*) as cnt,
            -- Use percentile_cont for true median across days-on-market.
            percentile_cont(0.5) within group (
                order by extract(epoch from (now() - first_seen_at)) / 86400
            )::int as median_dom,
            extract(epoch from (now() - min(first_seen_at))) / 86400 as max_dom
        from listings
        where is_active = true and source = 'hipflat'
        group by condo_id
    )
    update condos c
    set active_listings_count = agg.cnt,
        median_listing_dom_days = agg.median_dom,
        max_listing_dom_days = agg.max_dom::int,
        dom_computed_at = now()
    from agg
    where c.id = agg.condo_id;

    -- Buildings with zero active listings: clear out so the site shows
    -- nothing rather than a stale value. Rewritten from `id not in
    -- (subquery)` to `not exists`: NOT IN is both a correctness trap (if
    -- listings.condo_id can ever be null, NOT IN against a subquery
    -- containing a null makes the whole comparison unknown for every row,
    -- silently matching nothing) and typically forces a worse plan than an
    -- anti-join; NOT EXISTS sidesteps both and can use
    -- listings_hipflat_active_condo_idx above.
    update condos c
    set active_listings_count = 0,
        median_listing_dom_days = null,
        max_listing_dom_days = null,
        dom_computed_at = now()
    where active_listings_count is not null
      and not exists (
          select 1 from listings l
          where l.condo_id = c.id and l.is_active = true and l.source = 'hipflat'
      );
end;
$$;
