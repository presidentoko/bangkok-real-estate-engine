-- Macro indicators (BOT, REIC, etc.) — apply via Supabase SQL editor. Idempotent.

create table if not exists macro_indicators (
    id              bigserial primary key,
    source          text not null,                  -- 'bot' | 'reic'
    series_code     text not null,                  -- e.g. 'FM_RT_001_S2'
    indicator_name  text not null,                  -- e.g. 'Policy Rate'
    period          date not null,                  -- first of period (month/quarter/year)
    value           numeric(18, 4),
    is_provisional  boolean not null default false,
    fetched_at      timestamptz not null default now(),
    constraint macro_indicators_unique
        unique (source, series_code, indicator_name, period)
);

create index if not exists macro_indicators_series_idx
    on macro_indicators (source, series_code, period desc);

create index if not exists macro_indicators_latest_idx
    on macro_indicators (indicator_name, period desc);

-- Convenience view: most recent value per (source, series_code, indicator_name).
create or replace view v_macro_latest as
select distinct on (source, series_code, indicator_name)
    source, series_code, indicator_name,
    period, value, is_provisional, fetched_at
from macro_indicators
order by source, series_code, indicator_name, period desc;
