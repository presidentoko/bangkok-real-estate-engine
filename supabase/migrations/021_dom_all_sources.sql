-- 021: active_listings_count and DOM from every source, not hipflat only.
--
-- recompute_condo_dom() (db/schema_phase6_dom.sql) counted only
-- source = 'hipflat' listings, and its second UPDATE reset every other
-- building to 0. Measured 2026-11-27: 29,692 active ddproperty + dotproperty
-- listings sit on 1,931 buildings, and 1,152 of those buildings pass no other
-- clause of hasIndexableSubstance() (web/lib/condoIndexability.ts), so they
-- serve `noindex` and stay out of the sitemap while showing real listings on
-- the page. Search Console had several of them at positions 1-3.
--
-- Non-hipflat listings are kept honest by scripts/mark_stale_listings.py
-- (weekly, --days 21), so an active row there was seen in the last 3 weeks.
-- hipflat keeps its existing behaviour (persist_detail_b manages it).
--
-- Apply in the Supabase SQL Editor, then run once:
--     select recompute_condo_dom();
-- Idempotent.

create index if not exists listings_active_condo_idx
    on listings(condo_id)
    where is_active = true;

create or replace function recompute_condo_dom() returns void
language plpgsql as $$
begin
    set local statement_timeout = '55s';

    with agg as (
        select
            condo_id,
            count(*) as cnt,
            percentile_cont(0.5) within group (
                order by extract(epoch from (now() - first_seen_at)) / 86400
            )::int as median_dom,
            extract(epoch from (now() - min(first_seen_at))) / 86400 as max_dom
        from listings
        where is_active = true and condo_id is not null
        group by condo_id
    )
    update condos c
    set active_listings_count = agg.cnt,
        median_listing_dom_days = agg.median_dom,
        max_listing_dom_days = agg.max_dom::int,
        dom_computed_at = now()
    from agg
    where c.id = agg.condo_id;

    update condos c
    set active_listings_count = 0,
        median_listing_dom_days = null,
        max_listing_dom_days = null,
        dom_computed_at = now()
    where active_listings_count is not null
      and not exists (
          select 1 from listings l
          where l.condo_id = c.id and l.is_active = true
      );
end;
$$;
