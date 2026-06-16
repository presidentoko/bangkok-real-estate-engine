-- Retiree suitability score (0-100) stored per condo.
-- Computed by scripts/compute_retiree_score.py, which ports web/lib/retiree.ts.
-- Idempotent — safe to re-apply.

alter table condos
    add column if not exists retiree_score             numeric(5,1),
    add column if not exists retiree_score_computed_at timestamptz;

create index if not exists condos_retiree_score_idx
    on condos (retiree_score)
    where retiree_score is not null;

comment on column condos.retiree_score is
    'Retiree suitability 0-100. >=75 excellent / >=55 good / >=35 fair / <35 weak. '
    'Computed from livability_metrics (hospitals, supermarkets, transit) + aqi_score.';
comment on column condos.retiree_score_computed_at is
    'When compute_retiree_score.py last updated this row.';

-- Refresh the published view so it includes the new columns.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
