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
--    listings. Run after each Tier B pass.
create or replace function recompute_condo_dom() returns void
language plpgsql as $$
begin
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

    -- Buildings with zero active listings: clear out so the site shows nothing
    -- rather than a stale value.
    update condos
    set active_listings_count = 0,
        median_listing_dom_days = null,
        max_listing_dom_days = null,
        dom_computed_at = now()
    where id not in (select condo_id from listings where is_active = true and source = 'hipflat')
      and active_listings_count is not null;
end;
$$;
