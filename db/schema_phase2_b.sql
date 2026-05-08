-- Phase 2 Tier B: per-unit listings + price chart + nearby + market summary.
-- Apply via Supabase SQL editor AFTER Tier A enrichment finishes.
-- Idempotent.

-- ---------------------------------------------------------------------
-- 1. listings table augmentation
--    The Phase 1 schema already created `listings` for time-series capture.
--    Add hipflat-specific columns + a unique constraint so Tier B can
--    upsert per-unit data idempotently.
-- ---------------------------------------------------------------------
alter table listings
    add column if not exists source text default 'hipflat',
    add column if not exists source_unit_id text,
    add column if not exists listing_url text,
    add column if not exists publisher text;

-- One-row-per-(condo, unit) for any single source. Uses a partial unique
-- index (NULL source_unit_id allowed for legacy rows that don't have it).
create unique index if not exists listings_condo_unit_uniq
    on listings(condo_id, source, source_unit_id)
    where source_unit_id is not null;

create index if not exists listings_publisher_idx on listings(publisher);

-- ---------------------------------------------------------------------
-- 2. Market summary (current snapshot, per operation) — folded into condos.
--    One row per condo so we can sort/filter inline without joins.
-- ---------------------------------------------------------------------
alter table condos
    add column if not exists market_rent_median numeric(14,2),
    add column if not exists market_rent_per_sqm numeric(12,2),
    add column if not exists market_rent_yoy_pct numeric(6,2),
    add column if not exists market_sale_median numeric(14,2),
    add column if not exists market_sale_per_sqm numeric(12,2),
    add column if not exists market_sale_yoy_pct numeric(6,2),
    add column if not exists market_summary_currency text,
    add column if not exists market_summary_updated_at timestamptz,
    add column if not exists tier_b_fetched_at timestamptz;

create index if not exists condos_tier_b_fetched_idx on condos(tier_b_fetched_at);

-- ---------------------------------------------------------------------
-- 3. Price-history chart series (13 months × 2 metrics × {rent,sale}).
--    Many rows per condo. captured_at lets us re-snapshot over time and
--    track how hipflat's published history itself shifts.
-- ---------------------------------------------------------------------
create table if not exists condo_market_chart (
    id bigserial primary key,
    condo_id uuid not null references condos(id) on delete cascade,
    period text not null check (period in ('rent', 'sale')),
    metric text not null check (metric in ('price', 'per_sqm')),
    currency text,
    -- 'Apr 25' → first day of that month UTC (2025-04-01).
    year_month date not null,
    value numeric(14,2),
    captured_at timestamptz not null default now(),
    constraint condo_market_chart_uniq
        unique (condo_id, period, metric, year_month, captured_at)
);

create index if not exists condo_market_chart_condo_idx
    on condo_market_chart(condo_id, period, metric, year_month);

-- ---------------------------------------------------------------------
-- 4. Projects nearby — a directed graph (condo → neighbour project URL).
--    neighbour may not exist in our condos table (could be off-Bangkok or
--    not yet seeded), so we store the URL/slug freeform; resolve later.
-- ---------------------------------------------------------------------
create table if not exists condo_neighbours (
    id bigserial primary key,
    condo_id uuid not null references condos(id) on delete cascade,
    neighbour_slug text not null,
    neighbour_url text not null,
    neighbour_name text,
    captured_at timestamptz not null default now(),
    constraint condo_neighbours_uniq unique (condo_id, neighbour_slug)
);

create index if not exists condo_neighbours_condo_idx on condo_neighbours(condo_id);
create index if not exists condo_neighbours_slug_idx on condo_neighbours(neighbour_slug);

-- ---------------------------------------------------------------------
-- 5. Parking & lift facts — semi-structured "key: value" pairs.
--    Hipflat's labels vary per building ("Charging stations on site",
--    "Number of lifts", "Number of parking lots", etc); we store raw
--    key/value, normalise downstream when we have enough samples.
-- ---------------------------------------------------------------------
create table if not exists condo_parking_facts (
    id bigserial primary key,
    condo_id uuid not null references condos(id) on delete cascade,
    fact_key text not null,
    fact_value text,
    constraint condo_parking_facts_uniq unique (condo_id, fact_key)
);

create index if not exists condo_parking_facts_condo_idx on condo_parking_facts(condo_id);
