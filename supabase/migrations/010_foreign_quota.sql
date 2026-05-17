-- FazWaz project-page foreign-quota inventory tracking. Idempotent.
-- Apply via Supabase SQL editor.

alter table condos
    add column if not exists foreign_quota_listings_available integer,
    add column if not exists thai_quota_listings_available    integer,
    add column if not exists total_quota_listings_observed    integer,
    add column if not exists foreign_quota_inventory_pct      numeric(5, 2),
    add column if not exists foreign_quota_fetched_at         timestamptz;

create index if not exists condos_foreign_quota_idx
    on condos (foreign_quota_inventory_pct)
    where foreign_quota_inventory_pct is not null;

comment on column condos.foreign_quota_listings_available is
  '# currently for-sale units tagged "Foreign Quota" on the project page';
comment on column condos.thai_quota_listings_available is
  '# currently for-sale units tagged "Thai Quota"';
comment on column condos.foreign_quota_inventory_pct is
  'foreign / (foreign + thai) × 100. High pct = lots of foreign-eligible units on sale.';
comment on column condos.foreign_quota_fetched_at is
  'When the project page was last scraped for quota counts';

-- Refresh condos_published with new columns.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
