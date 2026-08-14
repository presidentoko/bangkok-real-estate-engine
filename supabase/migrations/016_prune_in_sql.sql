-- 016: move the retention prune into SQL so it stops shipping the tables
-- over the wire just to pick row ids.
--
-- scripts/prune_price_history.py decided what to delete in Python, so every
-- run pulled the tables in full first: price_history 861,148 rows at
-- 137 B/row (113 MB) plus condo_market_chart 111,696 rows (12 MB). Measured
-- 2026-08-13 while tracing a Supabase free-tier egress overage (5.88/5 GB,
-- 100% attributed to PostgREST) — 125 MB per run, weekly, was ~10% of the
-- monthly budget.
--
-- And at that moment it was deleting nothing at all: zero price_history rows
-- were older than the 6-month retention window (snapshots only started ~5.5
-- months earlier), so the whole 113 MB was spent to compute an empty list.
-- Done in SQL the cost is the same either way — one integer comes back.
--
-- Semantics are a direct translation of compute_price_history_deletions()
-- and compute_chart_deletions(); the Python functions are kept as the
-- reference implementation and the script cross-checks the two counts on
-- every dry run.
--
-- Batched on purpose. recompute_region_averages() taught us that a statement
-- touching these tables end-to-end overruns PostgREST's timeout and rolls
-- back (57014). Each call deletes at most p_batch_size rows and returns how
-- many it took, so the caller loops until it returns 0 and no single
-- statement runs long.

-- price_history: always keep the newest p_keep_recent snapshots per
-- (condo_id, listing_type) whatever their age; keep everything inside the
-- retention window at full resolution; beyond it keep one row per calendar
-- month per group.
create or replace function prune_price_history(
    p_keep_recent      integer default 2,
    p_retention_months integer default 6,
    p_batch_size       integer default 20000,
    p_dry_run          boolean default true
) returns integer
language plpgsql as $$
declare
    -- days => months * 30, NOT make_interval(months => ...). The Python
    -- reference uses timedelta(days=retention_months * 30), and calendar
    -- months would put the cutoff on a different day — enough to make the
    -- two implementations disagree on rows near the boundary and break the
    -- cross-check the script runs on every dry run.
    v_cutoff timestamptz := now() - make_interval(days => p_retention_months * 30);
    v_ids    bigint[];
    v_count  integer;
begin
    select array_agg(id) into v_ids
    from (
        select id
        from (
            select id,
                   row_number() over (
                       partition by condo_id, listing_type, date_trunc('month', captured_at)
                       order by captured_at desc, id desc
                   ) as month_rn
            from (
                select id, condo_id, listing_type, captured_at,
                       row_number() over (
                           partition by condo_id, listing_type
                           order by captured_at desc, id desc
                       ) as rn
                from price_history
            ) ranked
            -- rn > keep_recent: the newest N per group are never candidates.
            -- captured_at < cutoff: nothing inside the retention window is
            -- ever deleted, which is what makes this safe to batch.
            where rn > p_keep_recent
              and captured_at < v_cutoff
        ) candidates
        where month_rn > 1          -- month_rn = 1 is that month's survivor
        limit p_batch_size
    ) victims;

    v_count := coalesce(array_length(v_ids, 1), 0);
    if p_dry_run or v_count = 0 then
        return v_count;
    end if;
    delete from price_history where id = any(v_ids);
    return v_count;
end;
$$;

-- condo_market_chart: keep only the newest p_keep_recent distinct
-- captured_at batches per condo. persist_detail_b() inserts a whole fresh
-- series on every Tier-B revisit instead of replacing the previous one, so
-- older batches are pure duplicates that condo/[slug] was unknowingly
-- blending into its 200-row window.
create or replace function prune_condo_market_chart(
    p_keep_recent integer default 2,
    p_batch_size  integer default 20000,
    p_dry_run     boolean default true
) returns integer
language plpgsql as $$
declare
    v_ids   bigint[];
    v_count integer;
begin
    select array_agg(id) into v_ids
    from (
        select c.id
        from condo_market_chart c
        where not exists (
            select 1
            from (
                select condo_id, captured_at,
                       dense_rank() over (
                           partition by condo_id order by captured_at desc
                       ) as br
                from (select distinct condo_id, captured_at from condo_market_chart) d
            ) k
            where k.condo_id = c.condo_id
              and k.captured_at = c.captured_at
              and k.br <= p_keep_recent
        )
        limit p_batch_size
    ) victims;

    v_count := coalesce(array_length(v_ids, 1), 0);
    if p_dry_run or v_count = 0 then
        return v_count;
    end if;
    delete from condo_market_chart where id = any(v_ids);
    return v_count;
end;
$$;

-- underpriced_alerts: plain age cutoff. Already filtered server-side on read,
-- but the ids still came back over the wire before being sent straight back
-- as a DELETE.
create or replace function prune_underpriced_alerts(
    p_max_age_days integer default 90,
    p_batch_size   integer default 20000,
    p_dry_run      boolean default true
) returns integer
language plpgsql as $$
declare
    v_ids   uuid[];
    v_count integer;
begin
    select array_agg(id) into v_ids
    from (
        select id from underpriced_alerts
        where detected_at < now() - make_interval(days => p_max_age_days)
        limit p_batch_size
    ) victims;

    v_count := coalesce(array_length(v_ids, 1), 0);
    if p_dry_run or v_count = 0 then
        return v_count;
    end if;
    delete from underpriced_alerts where id = any(v_ids);
    return v_count;
end;
$$;
