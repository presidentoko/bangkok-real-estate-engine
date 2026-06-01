-- Phase 9: Developer track record from FazWaz project pages [B2].
-- condos.developer already exists (long unused / always null); add the slug
-- (stable FazWaz developer id) + portfolio counts. Populated by the
-- foreign-quota scrape (enrich_foreign_quota.py) which already fetches the
-- project page. Apply via Supabase SQL editor. Idempotent.

alter table condos
    add column if not exists developer_slug text,
    add column if not exists developer_project_count integer,
    add column if not exists developer_unit_count integer;

-- Postgres pins a view's column list at creation time, so new condos columns
-- don't appear through condos_published until the view is recreated.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;

-- Sort/group by developer without a request-time scan.
create index if not exists condos_developer_slug_idx on condos(developer_slug)
    where developer_slug is not null;
