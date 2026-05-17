-- REIC research-report ingest. Idempotent.
-- Apply via Supabase SQL editor.

create table if not exists reic_reports (
    id            bigserial primary key,
    reic_id       integer not null unique,
    title         text,
    summary       text,
    region        text,
    category      text,
    published_at  date,
    url           text not null,
    -- Optional LLM-extracted structured fields (populated by a separate pass).
    price_index           numeric(8, 2),
    yoy_change_pct        numeric(6, 2),
    qoq_change_pct        numeric(6, 2),
    supply_units          integer,
    absorption_pct        numeric(5, 2),
    llm_extracted_at      timestamptz,
    fetched_at    timestamptz not null default now()
);

create index if not exists reic_reports_published_idx
    on reic_reports (published_at desc);
create index if not exists reic_reports_category_idx
    on reic_reports (category);
create index if not exists reic_reports_region_idx
    on reic_reports (region);
