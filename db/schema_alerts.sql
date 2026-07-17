-- Underpriced-listing alert system. Apply AFTER schema.sql.

create table if not exists alert_subscribers (
    id uuid primary key default uuid_generate_v4(),
    channel text not null check (channel in ('telegram', 'web_push')),
    channel_id text not null,                -- telegram chat_id, or push endpoint URL
    push_p256dh text,                        -- web push only
    push_auth text,                          -- web push only
    districts text[],                        -- empty/null = subscribe to all districts
    bubble_threshold numeric(5,2) default 80,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    last_alert_sent_at timestamptz,
    unique (channel, channel_id)
);

create index if not exists subs_active_channel_idx
    on alert_subscribers(channel, is_active) where is_active = true;

create table if not exists underpriced_alerts (
    id uuid primary key default uuid_generate_v4(),
    condo_id uuid not null references condos(id) on delete cascade,
    listing_id uuid references listings(id) on delete set null,
    bubble_index numeric(6,2) not null,
    region_name text,
    price numeric(14,2),
    price_per_sqm numeric(12,2),
    region_avg_pps numeric(12,2),
    detected_at timestamptz not null default now(),
    sent_at timestamptz,
    sent_to_count integer default 0
);

create index if not exists alerts_undelivered_idx
    on underpriced_alerts(detected_at) where sent_at is null;
create index if not exists alerts_condo_recent_idx
    on underpriced_alerts(condo_id, detected_at desc);

-- Recent alerts for the public feed (suppress dupes within 14 days).
create or replace view v_recent_alerts as
select distinct on (a.condo_id)
    a.id, a.condo_id, c.slug, c.name, c.url, a.region_name,
    a.bubble_index, a.price, a.price_per_sqm, a.region_avg_pps,
    a.detected_at, a.sent_to_count
from underpriced_alerts a
join condos c on c.id = a.condo_id
where a.detected_at > now() - interval '14 days'
order by a.condo_id, a.detected_at desc;
