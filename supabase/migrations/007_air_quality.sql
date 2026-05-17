-- Air quality (WAQI) per-condo enrichment. Idempotent.
-- Apply via Supabase SQL editor.

alter table condos
    add column if not exists aqi_score          integer,
    add column if not exists pm25_value         numeric(6, 2),
    add column if not exists aqi_station_name   text,
    add column if not exists aqi_fetched_at     timestamptz;

create index if not exists condos_aqi_idx
    on condos (aqi_score)
    where aqi_score is not null;

comment on column condos.aqi_score is
  'Most recent AQI from the nearest WAQI monitoring station';
comment on column condos.pm25_value is
  'Most recent PM2.5 reading (μg/m³) from the nearest WAQI station';
comment on column condos.aqi_station_name is
  'Source station name (e.g. "Bangkok / Bang Na")';
comment on column condos.aqi_fetched_at is
  'When the AQI reading was pulled. Refresh weekly.';

-- Refresh condos_published with new columns.
create or replace view condos_published
    with (security_invoker = on)
    as select * from condos where published = true;

grant select on condos_published to anon, authenticated, service_role;
