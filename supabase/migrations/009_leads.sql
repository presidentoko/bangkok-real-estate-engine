-- Lead capture — consultation requests from the public site.
-- Apply via Supabase SQL editor. Idempotent + tolerant of half-applied state.

create extension if not exists "uuid-ossp";

-- Table: minimal id + email so CREATE always succeeds. Other columns added
-- via ALTER TABLE so partially-created tables (from a failed previous run)
-- still end up with the full schema.
create table if not exists leads (
    id    uuid primary key default uuid_generate_v4(),
    email text not null
);

alter table leads add column if not exists condo_id        uuid references condos(id) on delete set null;
alter table leads add column if not exists name            text;
alter table leads add column if not exists phone           text;
alter table leads add column if not exists budget_min      numeric(14, 2);
alter table leads add column if not exists budget_max      numeric(14, 2);
alter table leads add column if not exists timeline        text;
alter table leads add column if not exists purpose         text;
alter table leads add column if not exists nationality     text;
alter table leads add column if not exists message         text;
alter table leads add column if not exists source_url      text;
alter table leads add column if not exists referrer        text;
alter table leads add column if not exists user_agent      text;
alter table leads add column if not exists ip_hash         text;
alter table leads add column if not exists status          text not null default 'new';
alter table leads add column if not exists assigned_to     text;
alter table leads add column if not exists internal_notes  text;
alter table leads add column if not exists created_at      timestamptz not null default now();
alter table leads add column if not exists updated_at      timestamptz not null default now();

-- Status allow-list (drop + recreate so re-runs are safe)
alter table leads drop constraint if exists leads_status_check;
alter table leads
    add constraint leads_status_check
    check (status in ('new', 'contacted', 'qualified', 'lost', 'closed'));

-- Indexes — only created now that we know the columns exist.
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
