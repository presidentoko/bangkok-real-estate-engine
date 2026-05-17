-- Lead capture — consultation requests from the public site.
-- Apply via Supabase SQL editor. Idempotent.

create extension if not exists "uuid-ossp";

create table if not exists leads (
    id              uuid primary key default uuid_generate_v4(),
    condo_id        uuid references condos(id) on delete set null,
    name            text,
    email           text not null,
    phone           text,
    budget_min      numeric(14, 2),
    budget_max      numeric(14, 2),
    timeline        text,    -- 'now' | '3mo' | '6mo' | '12mo' | 'browsing'
    purpose         text,    -- 'own' | 'rent_invest' | 'flip' | 'undecided'
    nationality     text,    -- free text ("KR", "Thai", etc.) — caller-supplied
    message         text,
    source_url      text,    -- page they submitted from
    referrer        text,    -- HTTP referer (if any)
    user_agent      text,
    ip_hash         text,    -- SHA1 of IP for rate-limit / dedup, never store raw IP
    status          text not null default 'new'
                    check (status in ('new','contacted','qualified','lost','closed')),
    assigned_to     text,    -- broker partner identifier, free text for now
    internal_notes  text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists leads_status_idx        on leads(status);
create index if not exists leads_condo_idx         on leads(condo_id) where condo_id is not null;
create index if not exists leads_created_idx       on leads(created_at desc);
create index if not exists leads_email_idx         on leads(email);
create index if not exists leads_ip_hash_recent_idx
    on leads(ip_hash, created_at desc)
    where ip_hash is not null;

-- updated_at trigger
create or replace function leads_set_updated_at() returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at
    before update on leads
    for each row execute function leads_set_updated_at();
