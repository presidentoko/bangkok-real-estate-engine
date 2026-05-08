-- Bangkok Real Estate Value Engine — Supabase / PostgreSQL schema.
-- Apply via: Supabase SQL editor, or `supabase db push`.

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Bangkok zones (Sukhumvit, Sathorn, Ari, ...) with rolling avg price/m².
create table if not exists regions (
    id uuid primary key default uuid_generate_v4(),
    name text not null unique,
    name_th text,
    avg_price_per_sqm numeric(12,2),
    listing_count integer default 0,
    last_recalculated_at timestamptz,
    created_at timestamptz not null default now()
);

-- Canonical condo (deduped per source by listing id).
create table if not exists condos (
    id uuid primary key default uuid_generate_v4(),
    source text not null check (source in ('ddproperty', 'hipflat')),
    source_listing_id text not null,
    name text not null,
    region_id uuid references regions(id) on delete set null,
    address text,
    latitude double precision,
    longitude double precision,
    completion_year integer,
    total_units integer,
    developer text,
    url text,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    is_active boolean not null default true,
    constraint unique_source_listing unique (source, source_listing_id)
);

create index if not exists condos_region_idx on condos(region_id);
create index if not exists condos_developer_idx on condos(developer);
create index if not exists condos_name_trgm_idx on condos using gin (name gin_trgm_ops);

-- Time-series of every observed listing (one row per scrape).
create table if not exists listings (
    id uuid primary key default uuid_generate_v4(),
    condo_id uuid not null references condos(id) on delete cascade,
    listing_type text not null check (listing_type in ('sale', 'rent')),
    price numeric(14,2) not null,
    currency text not null default 'THB',
    area_sqm numeric(8,2),
    price_per_sqm numeric(12,2) generated always as
        (case when area_sqm > 0 then price / area_sqm else null end) stored,
    bedrooms smallint,
    bathrooms smallint,
    floor_level smallint,
    scraped_at timestamptz not null default now()
);

create index if not exists listings_condo_idx on listings(condo_id);
create index if not exists listings_scraped_idx on listings(scraped_at desc);

-- Price-change ledger (delta vs previous capture).
create table if not exists price_history (
    id bigserial primary key,
    condo_id uuid not null references condos(id) on delete cascade,
    listing_type text not null,
    price numeric(14,2) not null,
    price_per_sqm numeric(12,2),
    delta_pct numeric(6,2),
    captured_at timestamptz not null default now()
);

create index if not exists price_history_condo_idx on price_history(condo_id, captured_at desc);

create table if not exists livability_metrics (
    condo_id uuid primary key references condos(id) on delete cascade,
    nearest_bts_distance_m integer,
    nearest_bts_station text,
    nearest_mrt_distance_m integer,
    nearest_mrt_station text,
    hospitals_within_1km integer,
    schools_within_1km integer,
    supermarkets_within_1km integer,
    livability_score numeric(5,2),
    computed_at timestamptz not null default now()
);

create table if not exists risk_factors (
    condo_id uuid primary key references condos(id) on delete cascade,
    flood_risk_level smallint check (flood_risk_level between 0 and 5),
    flood_risk_source text,
    active_construction_within_500m boolean,
    construction_count integer default 0,
    risk_penalty numeric(5,2),
    computed_at timestamptz not null default now()
);

create table if not exists value_scores (
    condo_id uuid primary key references condos(id) on delete cascade,
    bubble_index numeric(6,2),
    livability_score numeric(5,2),
    risk_penalty numeric(5,2),
    asset_value_score numeric(5,2),
    livability_rank_pct numeric(5,2),
    asset_rank_pct numeric(5,2),
    is_super_value boolean default false,
    computed_at timestamptz not null default now()
);

create index if not exists value_scores_super_idx on value_scores(is_super_value)
    where is_super_value = true;

create table if not exists developer_reports (
    id uuid primary key default uuid_generate_v4(),
    condo_id uuid not null references condos(id) on delete cascade,
    developer text,
    summary_strengths text[],
    summary_weaknesses text[],
    recommendations text,
    generated_at timestamptz not null default now()
);

-- Latest active listing per condo.
create or replace view v_latest_listings as
select distinct on (condo_id)
    condo_id, id as listing_id, listing_type, price, area_sqm, price_per_sqm, scraped_at
from listings
order by condo_id, scraped_at desc;

-- Recompute regional averages from latest listings.
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

-- Convenience view: Super Value board.
create or replace view v_super_value_condos as
select c.id, c.name, c.developer, r.name as region,
       v.bubble_index, v.livability_score, v.risk_penalty,
       v.asset_value_score, v.livability_rank_pct, v.asset_rank_pct,
       l.price, l.area_sqm, l.price_per_sqm, c.url
from value_scores v
join condos c on c.id = v.condo_id
left join regions r on r.id = c.region_id
left join v_latest_listings l on l.condo_id = c.id
where v.is_super_value = true
order by (v.asset_rank_pct + coalesce(v.livability_rank_pct, 0)) desc;
