-- Phase 7: Resale Liquidity Score on value_scores.
-- "If I buy here, can I get my money back out?" — no portal answers the
-- investor's real fear. We can, because src/db.py flips is_active=false the
-- moment a hipflat listing disappears, so we know each listing's real
-- time-to-clear. Apply via Supabase SQL editor. Idempotent.

alter table value_scores
    add column if not exists liquidity_score numeric(5,2),
    add column if not exists liquidity_grade text,
    add column if not exists liquidity_absorption_rate numeric(5,2),
    add column if not exists liquidity_median_sold_dom integer,
    add column if not exists liquidity_sample_size integer,
    add column if not exists liquidity_computed_at timestamptz;

-- Sort "most liquid first" without a request-time scan.
create index if not exists value_scores_liquidity_idx
    on value_scores(liquidity_score desc) where liquidity_score is not null;
