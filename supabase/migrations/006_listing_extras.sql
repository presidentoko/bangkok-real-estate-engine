-- FazWaz extras + building cost-of-ownership. Idempotent.
-- Apply via Supabase SQL editor.

-- Building-level (CAM fee, sinking fund, ownership category)
alter table condos
    add column if not exists cam_fee_per_month   numeric(10, 2),
    add column if not exists sinking_fund        numeric(12, 2),
    add column if not exists building_ownership  text;

comment on column condos.cam_fee_per_month is
  'Monthly common-area maintenance fee in THB (source: FazWaz extras)';
comment on column condos.sinking_fund is
  'One-time sinking fund contribution in THB (source: FazWaz extras)';
comment on column condos.building_ownership is
  'Ownership category (e.g. "Thai Quota", "Foreign Quota") — building-level designation';

-- Listing-level (FazWaz pre-computed yield + estimated rent for sale units)
alter table listings
    add column if not exists est_rent_per_month  numeric(12, 2),
    add column if not exists provided_yield_pct  numeric(5, 2);

comment on column listings.est_rent_per_month is
  'Source-provided monthly rent estimate (FazWaz: "Est. Rent" chip on sale listings)';
comment on column listings.provided_yield_pct is
  'Source-provided gross yield % (FazWaz: "ROI" chip). Our computed yield lives on condos.gross_yield_pct';

-- Refresh condos_published so the new columns are queryable through the view.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
