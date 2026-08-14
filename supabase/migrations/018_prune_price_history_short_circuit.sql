-- 018: stop prune_price_history() timing out when there is nothing to prune.
--
-- 017 filtered before ranking, which fixed the many-candidates case, but the
-- zero-candidates case still died on the timeout — the case that matters,
-- because it is the steady state. Measured on the live table:
--
--     older than  30d: 793,384 rows   -> months=1 returns in 0.3s
--     older than  60d: 445,975 rows   -> months=2 returns in 0.4s
--     older than  90d:       0 rows   -> months=3 TIMES OUT
--     older than 180d:       0 rows   -> months=6 (the default) TIMES OUT
--
-- Backwards, and that is the tell. With many candidates the outer LIMIT lets
-- Postgres stop early. With none, `affected` is empty, but the planner was
-- free to build `recent_counts` first — a GROUP BY over every row newer than
-- the cutoff, i.e. the entire 861k-row table — before discovering it had
-- nothing to join against.
--
-- Two changes:
--
--   1. Short-circuit. If no row is older than the cutoff there is provably
--      nothing to delete, so return before planning any of it. This is an
--      index probe with LIMIT 1 against price_history_captured_at_idx.
--
--   2. Count recent rows per affected group with a correlated subquery
--      instead of a table-wide GROUP BY. It runs once per group that
--      actually has old rows and uses price_history_condo_idx
--      (condo_id, captured_at desc), so the cost scales with the size of the
--      prunable tail rather than with the table.

create or replace function prune_price_history(
    p_keep_recent      integer default 2,
    p_retention_months integer default 6,
    p_batch_size       integer default 20000,
    p_dry_run          boolean default true
) returns integer
language plpgsql as $$
declare
    -- days => months * 30, matching the Python reference's
    -- timedelta(days=retention_months * 30).
    v_cutoff timestamptz := now() - make_interval(days => p_retention_months * 30);
    v_ids    bigint[];
    v_count  integer;
begin
    -- Nothing older than the cutoff => nothing is deletable, by definition:
    -- every deletion candidate must satisfy captured_at < cutoff.
    perform 1 from price_history where captured_at < v_cutoff limit 1;
    if not found then
        return 0;
    end if;

    select array_agg(id) into v_ids
    from (
        with old_ranked as (
            select id, condo_id, listing_type, captured_at,
                   row_number() over (
                       partition by condo_id, listing_type
                       order by captured_at desc, id desc
                   ) as old_rn
            from price_history
            where captured_at < v_cutoff
        ),
        affected as (
            select distinct condo_id, listing_type from old_ranked
        ),
        recent_counts as (
            -- Correlated on purpose: one indexed count per affected group,
            -- rather than a GROUP BY across every recent row in the table.
            select a.condo_id, a.listing_type,
                   (select count(*)
                      from price_history p
                     where p.condo_id = a.condo_id
                       and p.listing_type = a.listing_type
                       and p.captured_at >= v_cutoff) as c
            from affected a
        ),
        candidates as (
            select o.id,
                   row_number() over (
                       partition by o.condo_id, o.listing_type,
                                    date_trunc('month', o.captured_at)
                       order by o.captured_at desc, o.id desc
                   ) as month_rn
            from old_ranked o
            left join recent_counts rc
              on rc.condo_id = o.condo_id
             and rc.listing_type = o.listing_type
            -- recent + rank-among-old = rank across the whole group, because
            -- every recent row sorts above every old one.
            where coalesce(rc.c, 0) + o.old_rn > p_keep_recent
        )
        select id from candidates
        where month_rn > 1
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

-- CREATE INDEX does not refresh planner statistics, and price_history had
-- grown far past its last autovacuum sample. Without this the short-circuit
-- probe above still chose a sequential scan and the default call took 5.4s —
-- most of an 8s statement timeout, for a question whose answer is "no rows".
-- After ANALYZE it is 0.17s.
analyze price_history;
analyze condo_market_chart;
