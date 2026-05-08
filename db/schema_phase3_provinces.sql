-- Phase 3: Province expansion (Pattaya, Hua Hin) with launch gating.
-- Apply via Supabase SQL editor. Idempotent — safe to re-run.

-- 1. condos.province : which province (city/region) the building sits in.
--    Default 'bangkok' so existing rows are correctly tagged retroactively.
--    published gates whether the building is visible on the site.
alter table condos
    add column if not exists province text not null default 'bangkok',
    add column if not exists published boolean not null default true;

create index if not exists condos_province_idx on condos(province);
create index if not exists condos_published_idx on condos(published) where published = true;

-- 2. regions.province : aggregations are per-region, but a region (e.g. 'jomtien')
--    only makes sense within a province. Default 'bangkok' for existing rows.
alter table regions
    add column if not exists province text not null default 'bangkok';

create index if not exists regions_province_idx on regions(province);

-- 3. Read-side gate: site queries this view, scrapers write the base table.
--    Launching a province is a single SQL statement:
--      update condos set published = true where province = 'pattaya';
--    security_invoker so the view inherits the caller's role (RLS on condos
--    still applies — no privilege escalation).
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;

-- 4. Aggregation should respect the publish gate so unlaunched provinces don't
--    pollute Bangkok averages.
create or replace function recompute_region_averages() returns void
language plpgsql as $$
begin
    with avg_per_region as (
        select c.region_id,
               avg(l.price_per_sqm) as avg_pps,
               count(*) as cnt
        from condos c
        join v_latest_listings l on l.condo_id = c.id
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
end;
$$;
