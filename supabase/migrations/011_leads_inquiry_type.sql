-- Existing Supabase projects had a `leads.inquiry_type` NOT NULL column
-- (from earlier scaffolding) that our /api/leads insert didn't populate,
-- causing every submission to 500. Relax the constraint and give it a
-- safe default so both our app and any legacy admin tool keep working.

-- 1. If the column doesn't exist on this project, create it as nullable.
--    'add column if not exists' is idempotent.
alter table leads add column if not exists inquiry_type text;

-- 2. Backfill existing nulls so we can safely change the default.
update leads set inquiry_type = 'consultation' where inquiry_type is null;

-- 3. Relax: allow nulls, give a sensible default for any forgotten caller.
alter table leads alter column inquiry_type drop not null;
alter table leads alter column inquiry_type set default 'consultation';
