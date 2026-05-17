-- Aggressive relaxation of the existing leads table — only required fields
-- stay NOT NULL (id + email). The user's Supabase had a more constrained
-- table from earlier scaffolding (NOT NULL on name, CHECK on inquiry_type),
-- which kept rejecting our consultation submissions.
--
-- Safe because: every legacy column simply allows NULL now. If you have an
-- admin UI that expects values, it still works — we just don't force them.

-- 1. inquiry_type CHECK constraint — drop if present, allow any text.
alter table leads drop constraint if exists leads_inquiry_type_check;

-- 2. Drop NOT NULL on every column that's "soft" (caller-supplied or optional).
--    Skip id (PK), email (we always have one), created_at/updated_at (auto).
do $$
declare
    col_name text;
begin
    for col_name in
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'leads'
          and is_nullable = 'NO'
          and column_name not in ('id', 'email', 'created_at', 'updated_at', 'status')
    loop
        execute format('alter table leads alter column %I drop not null', col_name);
    end loop;
end $$;

-- 3. Helpful default on inquiry_type so legacy admin paths don't break.
alter table leads alter column inquiry_type set default 'general';
