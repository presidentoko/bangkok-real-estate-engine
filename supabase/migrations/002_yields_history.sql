-- Yield + price history additions.
-- Apply via Supabase SQL editor. Idempotent.

-- Yield columns on condos (computed from matched sale+rent listings).
alter table condos
    add column if not exists avg_sale_price    numeric(14,2),
    add column if not exists avg_monthly_rent  numeric(14,2),
    add column if not exists gross_yield_pct   numeric(5,2),
    add column if not exists yield_sample_sale integer,
    add column if not exists yield_sample_rent integer,
    add column if not exists yield_computed_at timestamptz;

create index if not exists condos_yield_idx on condos(gross_yield_pct)
    where gross_yield_pct is not null;

-- Convenience view: condos ranked by yield.
create or replace view v_condo_yields as
select
    c.id,
    c.name,
    c.source,
    r.name                  as region,
    c.province,
    c.avg_sale_price,
    c.avg_monthly_rent,
    c.gross_yield_pct,
    c.yield_sample_sale,
    c.yield_sample_rent,
    c.yield_computed_at
from condos c
left join regions r on r.id = c.region_id
where c.gross_yield_pct is not null
order by c.gross_yield_pct desc;

-- Price-change snapshot function.
-- Call once per week (after scrape) to record deltas.
create or replace function snapshot_prices() returns integer
language plpgsql as $$
declare
    inserted integer := 0;
begin
    insert into price_history (condo_id, listing_type, price, price_per_sqm, delta_pct, captured_at)
    select
        l.condo_id,
        l.listing_type,
        avg(l.price)          as price,
        avg(l.price_per_sqm)  as price_per_sqm,
        case
            when prev.price is not null and prev.price > 0
            then round(((avg(l.price) - prev.price) / prev.price * 100)::numeric, 2)
        end                   as delta_pct,
        now()
    from listings l
    left join lateral (
        select ph.price
        from price_history ph
        where ph.condo_id = l.condo_id
          and ph.listing_type = l.listing_type
        order by ph.captured_at desc
        limit 1
    ) prev on true
    where l.is_active = true
      and l.price is not null
    group by l.condo_id, l.listing_type, prev.price;

    get diagnostics inserted = row_count;
    return inserted;
end;
$$;
