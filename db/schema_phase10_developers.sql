-- Phase 10: per-developer aggregates (true "developer report card") [B2+].
-- Groups our condos by developer_slug and rolls up the signals that fazwaz
-- developer-tagged buildings actually carry (yield, foreign quota) + how many
-- buildings we track for them. Apply via Supabase SQL editor. Idempotent.

create table if not exists developers (
    developer_slug        text primary key,
    developer_name        text,
    fazwaz_project_count  integer,          -- developer's portfolio size on FazWaz
    fazwaz_unit_count     integer,
    tracked_buildings     integer not null default 0,  -- # condos WE track for them
    avg_gross_yield_pct   numeric(5, 2),
    avg_foreign_quota_pct numeric(5, 2),
    computed_at           timestamptz not null default now()
);

grant select on developers to anon, authenticated, service_role;
