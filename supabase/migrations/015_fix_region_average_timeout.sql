-- 015: make recompute_region_averages() finish inside the statement timeout.
--
-- 014 shipped it as two statements: an UPDATE ... FROM over the aggregate,
-- then a second UPDATE with a correlated `NOT EXISTS (select 1 from condos
-- join v_latest_sale_listings ...)` to clear districts that no longer have a
-- qualifying sale listing. That subquery re-derives v_latest_sale_listings —
-- a distinct-on over ~250k listings rows — once per region, 154 times over.
-- Calling the RPC through PostgREST died with 57014 canceling statement due
-- to statement timeout, and since the function body is one transaction the
-- whole recompute rolled back, leaving regions.avg_price_per_sqm on the old
-- rent/sale-mixed numbers.
--
-- Rewritten as a single pass: aggregate once into a CTE, LEFT JOIN every
-- region against it, and let the join decide. A region with no qualifying
-- sale listing simply gets NULL from the join, which is the same "clear the
-- stale average" behaviour the second statement was written for — the point
-- being that a district that loses its listings must not keep serving a
-- stale number as a bubble_index denominator forever.
--
-- The supporting index is what makes the distinct-on cheap: it puts the sale
-- rows in (condo_id, scraped_at desc) order so the view is an index scan
-- rather than a full sort of the table.

create index if not exists listings_sale_latest_idx
    on listings (condo_id, scraped_at desc)
    where listing_type = 'sale' and price_per_sqm is not null;

create or replace function recompute_region_averages() returns void
language plpgsql as $$
begin
    with avg_per_region as (
        select c.region_id,
               avg(l.price_per_sqm) as avg_pps,
               count(*)             as cnt
        from condos c
        join v_latest_sale_listings l on l.condo_id = c.id
        where c.region_id is not null
          and l.price_per_sqm is not null
          and c.is_active = true
          and c.published = true
        group by c.region_id
    ),
    per_region as (
        -- LEFT JOIN so regions with no qualifying sale listing come through
        -- with NULLs and get cleared, instead of being skipped.
        select r.id, a.avg_pps, a.cnt
        from regions r
        left join avg_per_region a on a.region_id = r.id
    )
    update regions r
    set avg_price_per_sqm  = p.avg_pps,
        listing_count      = coalesce(p.cnt, 0),
        last_recalculated_at = now()
    from per_region p
    where r.id = p.id;
end;
$$;
