-- Phase 4: Inbound contact / revenue inquiries.
-- Apply via Supabase SQL editor. Idempotent.

create table if not exists leads (
    id uuid primary key default uuid_generate_v4(),
    -- Routing tag so admin can triage by type.
    inquiry_type text not null check (inquiry_type in (
        'general', 'promote', 'b2b_reports', 'press', 'other'
    )),
    name text not null,
    email text not null,
    message text not null,
    -- Optional: condo the inquiry references (e.g. "promote my condo X").
    condo_id uuid references condos(id) on delete set null,
    -- Origin URL — helps us see what the visitor was looking at.
    referrer text,
    -- Anti-spam: simple per-IP rate-limit signal (filled by API).
    submitter_ip text,
    created_at timestamptz not null default now(),
    -- Admin workflow.
    handled boolean not null default false,
    handled_at timestamptz,
    notes text
);

create index if not exists leads_type_idx on leads(inquiry_type);
create index if not exists leads_handled_idx on leads(handled, created_at desc);
create index if not exists leads_created_idx on leads(created_at desc);

-- Service-key-only access. Anon can INSERT (form submit) but not read.
alter table leads enable row level security;

drop policy if exists leads_insert_anon on leads;
create policy leads_insert_anon on leads
    for insert
    to anon, authenticated
    with check (true);

-- No SELECT/UPDATE/DELETE for anon — service-role bypasses RLS for admin.
