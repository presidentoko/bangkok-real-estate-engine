-- Migration 014: keyword slug for condo detail pages
-- Replaces /condo/{UUID} URLs with /condo/{name-province} slugs.
--
-- Apply in Supabase SQL editor, then run:
--   python scripts/backfill_condo_slug.py
--
-- Postgres pins a view's column list at creation time, so adding a column to
-- `condos` does not propagate to `condos_published`. Re-create the view after
-- the ALTER so the new `slug` column is queryable through it.

alter table condos
    add column if not exists slug text;

create unique index if not exists condos_slug_unique
    on condos (slug)
    where slug is not null;

create index if not exists condos_slug_idx on condos (slug);

-- Refresh the published view so `slug` is visible.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
