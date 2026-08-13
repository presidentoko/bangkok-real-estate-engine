-- 014: stop averaging sale prices and monthly rents into one number.
--
-- THE BUG
-- -------
-- v_latest_listings picks the most recent listing per condo with no regard
-- for listing_type:
--
--     select distinct on (condo_id) ... from listings
--     order by condo_id, scraped_at desc;
--
-- So each condo contributes EITHER a sale price_per_sqm or a monthly-rent
-- price_per_sqm, whichever happened to be scraped last. Measured 2026-08-13
-- across the 8,896 rows the view returns:
--
--     sale  n=4,618   median price_per_sqm =  72,172 THB
--     rent  n=2,788   median price_per_sqm =     297 THB
--
-- a 243x difference in scale, in one column.
--
-- recompute_region_averages() then avg()s that column into
-- regions.avg_price_per_sqm, and bubble_index divides a condo's
-- price_per_sqm by it:
--
--     bubble_index = condo_price_per_sqm / region_avg_price_per_sqm * 100
--
-- Both sides of that ratio are rent/sale mixtures, in a proportion that
-- varies per district. The result is not a district premium, it is noise:
-- the observed distribution had median 13 (a number that should centre on
-- 100), p99 2,671, and a maximum of 64,518 — a condo whose latest listing
-- was a sale, divided by a district average dominated by rents.
--
-- That figure is the "priced X% above district average" line on every condo
-- page, and it also drives value_scores.is_super_value and the
-- underpriced_alerts Telegram feed (bubble_index <= threshold), which means
-- alerts were firing on condos that merely happened to have a rent listing
-- scraped most recently.
--
-- THE FIX
-- -------
-- Add a sale-only sibling view and point the price benchmark at it. Note
-- this is NOT the same as filtering v_latest_listings to listing_type='sale'
-- after the fact — that would drop a condo entirely when its newest listing
-- is a rental, even though it has a perfectly good older sale listing. The
-- distinct-on has to run over sale rows in the first place.
--
-- v_latest_listings itself is deliberately left alone: condo/[slug] and
-- reality/[id] read it for "the most recent listing, whatever it is", which
-- is the right semantics for those pages.

create or replace view v_latest_sale_listings as
select distinct on (condo_id)
    condo_id, id as listing_id, listing_type, price, area_sqm, price_per_sqm, scraped_at
from listings
where listing_type = 'sale'
  and price_per_sqm is not null
order by condo_id, scraped_at desc;

grant select on v_latest_sale_listings to anon, authenticated, service_role;

-- Same body as the phase-3 definition (which added the `published` gate so
-- unlaunched provinces don't pollute Bangkok averages), with the source view
-- swapped for the sale-only one.
create or replace function recompute_region_averages() returns void
language plpgsql as $$
begin
    with avg_per_region as (
        select c.region_id,
               avg(l.price_per_sqm) as avg_pps,
               count(*) as cnt
        from condos c
        join v_latest_sale_listings l on l.condo_id = c.id
        where c.region_id is not null
          and l.price_per_sqm is not null
          and c.is_active = true
          and c.published = true
        group by c.region_id
    )
    update regions r
    set avg_price_per_sqm = a.avg_pps,
        listing_count = a.cnt,
        last_recalculated_at = now()
    from avg_per_region a
    where r.id = a.region_id;

    -- A district that no longer has any qualifying sale listing used to keep
    -- its last computed average forever, because the UPDATE ... FROM above
    -- only touches regions that appear in avg_per_region. That stale number
    -- stayed live as a bubble_index denominator indefinitely. Clear it.
    update regions r
    set avg_price_per_sqm = null,
        listing_count = 0,
        last_recalculated_at = now()
    where not exists (
        select 1
        from condos c
        join v_latest_sale_listings l on l.condo_id = c.id
        where c.region_id = r.id
          and c.is_active = true
          and c.published = true
    )
    and r.avg_price_per_sqm is not null;
end;
$$;
