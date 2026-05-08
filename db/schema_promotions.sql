-- Influencer-promoted condos. Apply AFTER schema.sql.
-- One condo can have multiple promotions (different YouTubers / blogs / posts).

create table if not exists condo_promotions (
    id uuid primary key default uuid_generate_v4(),
    condo_id uuid not null references condos(id) on delete cascade,
    promoted_by text not null,           -- influencer / channel name
    promotion_url text,                   -- YouTube / blog URL
    platform text check (platform in (
        'youtube', 'blog', 'instagram', 'tiktok', 'news', 'other'
    )),
    claim text,                           -- one-line marketing claim being tested
    promoted_at date,
    added_at timestamptz not null default now(),
    added_by text default 'admin'
);

create index if not exists promotions_condo_idx on condo_promotions(condo_id);
create index if not exists promotions_added_idx on condo_promotions(added_at desc);

-- Convenience view: promoted condos joined with latest data signals.
create or replace view v_promoted_condos as
select
    c.id as condo_id, c.name, c.region_id, r.name as region_name,
    c.url as listing_url, c.developer,
    p.id as promotion_id, p.promoted_by, p.promotion_url, p.platform,
    p.claim, p.promoted_at, p.added_at,
    v.bubble_index, v.is_super_value, v.asset_value_score,
    l.price, l.area_sqm, l.price_per_sqm
from condos c
join condo_promotions p on p.condo_id = c.id
left join regions r on r.id = c.region_id
left join value_scores v on v.condo_id = c.id
left join v_latest_listings l on l.condo_id = c.id
where c.is_active = true
order by p.added_at desc;
