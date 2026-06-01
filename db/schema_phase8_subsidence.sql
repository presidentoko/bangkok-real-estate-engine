-- Phase 8: Land-subsidence ("ground stability") overlay on risk_factors.
-- Bangkok sits on soft marine clay; the eastern belt + coastal south keep
-- sinking, compounding flood exposure. District-level level 0..5, sourced like
-- the flood layer. Apply via Supabase SQL editor. Idempotent.

alter table risk_factors
    add column if not exists subsidence_level smallint
        check (subsidence_level is null or subsidence_level between 0 and 5),
    add column if not exists subsidence_source text;
