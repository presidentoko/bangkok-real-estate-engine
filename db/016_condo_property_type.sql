-- Migration 016: condos.property_type
-- Discovered during the 2026-07-21 fresh-Supabase-project migration: this
-- column existed on the live production project but was never captured in
-- any committed schema file (added by hand at some point). Documenting it
-- here so a future fresh-project bootstrap doesn't hit the same gap.
--
-- Postgres pins a view's column list at creation time, so adding a column to
-- `condos` does not propagate to `condos_published`. Re-create the view after
-- the ALTER so the new `property_type` column is queryable through it.

alter table condos
    add column if not exists property_type text not null default 'condo';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'condos_property_type_chk'
    ) then
        alter table condos
            add constraint condos_property_type_chk
            check (property_type in ('condo', 'apartment', 'serviced-apartment', 'house', 'villa', 'townhouse'));
    end if;
end$$;

create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
