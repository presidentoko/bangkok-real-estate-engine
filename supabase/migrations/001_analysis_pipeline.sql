-- Analysis pipeline tables & schema additions
-- Run once in Supabase SQL editor.

-- 1. value_scores: super value columns
ALTER TABLE value_scores
  ADD COLUMN IF NOT EXISTS is_super_value       boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS asset_value_score    numeric,
  ADD COLUMN IF NOT EXISTS livability_score     numeric,
  ADD COLUMN IF NOT EXISTS risk_penalty         numeric,
  ADD COLUMN IF NOT EXISTS asset_rank_pct       numeric,
  ADD COLUMN IF NOT EXISTS livability_rank_pct  numeric;

-- 2. risk_factors: construction + penalty columns
ALTER TABLE risk_factors
  ADD COLUMN IF NOT EXISTS active_construction_within_500m boolean,
  ADD COLUMN IF NOT EXISTS construction_count              integer,
  ADD COLUMN IF NOT EXISTS risk_penalty                    numeric,
  ADD COLUMN IF NOT EXISTS computed_at                     timestamptz;

-- 3. Latest active listing per condo (used by underpriced detection)
-- CASCADE drops dependent views (v_super_value_condos, v_promoted_condos); recreated below.
DROP VIEW IF EXISTS v_latest_listings CASCADE;

CREATE VIEW v_latest_listings AS
SELECT DISTINCT ON (condo_id)
    condo_id,
    id AS listing_id,
    listing_type,
    price,
    area_sqm,
    price_per_sqm,
    scraped_at
FROM listings
WHERE is_active = true
ORDER BY condo_id, scraped_at DESC NULLS LAST;

CREATE VIEW v_super_value_condos AS
SELECT c.id,
    c.name,
    c.developer,
    r.name AS region,
    v.bubble_index,
    v.livability_score,
    v.risk_penalty,
    v.asset_value_score,
    v.livability_rank_pct,
    v.asset_rank_pct,
    l.price,
    l.area_sqm,
    l.price_per_sqm,
    c.url
FROM (((value_scores v
    JOIN condos c ON ((c.id = v.condo_id)))
    LEFT JOIN regions r ON ((r.id = c.region_id)))
    LEFT JOIN v_latest_listings l ON ((l.condo_id = c.id)))
WHERE (v.is_super_value = true)
ORDER BY (v.asset_rank_pct + COALESCE(v.livability_rank_pct, (0)::numeric)) DESC;

CREATE VIEW v_promoted_condos AS
SELECT c.id AS condo_id,
    c.name,
    c.region_id,
    r.name AS region_name,
    c.url AS listing_url,
    c.developer,
    p.id AS promotion_id,
    p.promoted_by,
    p.promotion_url,
    p.platform,
    p.claim,
    p.promoted_at,
    p.added_at,
    v.bubble_index,
    v.is_super_value,
    v.asset_value_score,
    l.price,
    l.area_sqm,
    l.price_per_sqm
FROM ((((condos c
    JOIN condo_promotions p ON ((p.condo_id = c.id)))
    LEFT JOIN regions r ON ((r.id = c.region_id)))
    LEFT JOIN value_scores v ON ((v.condo_id = c.id)))
    LEFT JOIN v_latest_listings l ON ((l.condo_id = c.id)))
WHERE (c.is_active = true)
ORDER BY p.added_at DESC;

-- 4. Underpriced alerts queue
CREATE TABLE IF NOT EXISTS underpriced_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id        uuid        REFERENCES condos(id) ON DELETE CASCADE,
  listing_id      uuid,
  bubble_index    numeric,
  region_name     text,
  price           numeric,
  price_per_sqm   numeric,
  region_avg_pps  numeric,
  detected_at     timestamptz DEFAULT now(),
  sent_at         timestamptz,
  sent_to_count   integer     DEFAULT 0
);
CREATE INDEX IF NOT EXISTS underpriced_alerts_condo_detected
  ON underpriced_alerts (condo_id, detected_at DESC);

-- 5. Telegram / future channel subscribers
CREATE TABLE IF NOT EXISTS alert_subscribers (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  channel          text    NOT NULL,         -- 'telegram'
  channel_id       text    NOT NULL,         -- chat_id
  is_active        boolean DEFAULT true,
  districts        text[],                   -- NULL = all districts
  bubble_threshold numeric DEFAULT 80,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (channel, channel_id)
);

-- 6. Per-condo developer reports (one row per condo, upserted on re-run)
CREATE TABLE IF NOT EXISTS developer_reports (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  condo_id            uuid        REFERENCES condos(id) ON DELETE CASCADE,
  developer           text,
  summary_strengths   text[],
  summary_weaknesses  text[],
  recommendations     text,
  generated_at        timestamptz DEFAULT now(),
  UNIQUE (condo_id)
);
