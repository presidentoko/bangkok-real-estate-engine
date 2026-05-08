-- Phase 2 Tier A: building detail enrichment from hipflat L3 JSON-LD.
-- Apply via Supabase SQL editor. Idempotent.

alter table condos
    add column if not exists floors smallint,
    add column if not exists description text,
    add column if not exists available_units_count integer,
    add column if not exists price_min numeric(14,2),
    add column if not exists price_max numeric(14,2),
    add column if not exists price_currency text,
    add column if not exists price_period text,
    add column if not exists detail_fetched_at timestamptz,
    add column if not exists hero_image_url text;

-- price_period is 'rent' or 'sale' (the only thing JSON-LD distinguishes).
-- Use a partial check so existing NULL rows aren't rejected.
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'condos_price_period_chk'
    ) then
        alter table condos
            add constraint condos_price_period_chk
            check (price_period is null or price_period in ('rent', 'sale'));
    end if;
end$$;

create index if not exists condos_geo_idx on condos(latitude, longitude)
    where latitude is not null;
create index if not exists condos_detail_fetched_idx on condos(detail_fetched_at);

-- Many-to-many amenities (Gym, Swimming pool, Sauna, ...).
create table if not exists condo_amenities (
    id bigserial primary key,
    condo_id uuid not null references condos(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    constraint unique_condo_amenity unique (condo_id, name)
);

create index if not exists condo_amenities_condo_idx on condo_amenities(condo_id);
create index if not exists condo_amenities_name_idx on condo_amenities(name);

-- BTS/MRT proximity comes from FAQ JSON-LD ("BTS X, BTS Y are close to ..."),
-- which is qualitative, not a measured distance. We store it as a list separate
-- from livability_metrics (which holds measured distances when available).
create table if not exists condo_transit (
    id bigserial primary key,
    condo_id uuid not null references condos(id) on delete cascade,
    line text not null check (line in ('BTS', 'MRT', 'ARL', 'SRT')),
    station text not null,
    source text not null default 'hipflat_faq',
    constraint unique_condo_transit unique (condo_id, line, station)
);

create index if not exists condo_transit_condo_idx on condo_transit(condo_id);
