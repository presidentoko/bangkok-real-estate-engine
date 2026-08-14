-- 017: fix prune_price_history() timing out on its own dry run.
--
-- 016 ranked first and filtered second:
--
--     select ... row_number() over (partition by condo_id, listing_type
--                                   order by captured_at desc) as rn
--     from price_history            -- all 861,148 rows
--     ...
--     where rn > p_keep_recent and captured_at < v_cutoff
--
-- A window function is evaluated before the outer WHERE, so Postgres had to
-- sort the entire table twice before it could discard anything. It hit the
-- statement timeout (57014) even in dry-run mode, and even though the answer
-- was zero rows.
--
-- Filter first instead. The key observation is that every row inside the
-- retention window sorts above every row outside it (that is what the cutoff
-- means), so for an old row:
--
--     global_rank = (rows in its group newer than the cutoff) + rank_among_old
--
-- which lets the ranking run over just the old rows and recovers the
-- keep_recent protection with a counting join. Identical output, and when
-- nothing is old enough to prune — the situation today, 0 of 861,148 rows —
-- the CTE is empty and the whole call is trivial.
--
-- The supporting index makes the `captured_at < cutoff` scan cheap; the
-- existing price_history_condo_idx leads with condo_id and cannot serve a
-- bare captured_at predicate.

create index if not exists price_history_captured_at_idx
    on price_history (captured_at);

create or replace function prune_price_history(
    p_keep_recent      integer default 2,
    p_retention_months integer default 6,
    p_batch_size       integer default 20000,
    p_dry_run          boolean default true
) returns integer
language plpgsql as $$
declare
    -- days => months * 30, matching the Python reference's
    -- timedelta(days=retention_months * 30). Calendar months would land the
    -- cutoff on a different day and make the two disagree near the boundary.
    v_cutoff timestamptz := now() - make_interval(days => p_retention_months * 30);
    v_ids    bigint[];
    v_count  integer;
begin
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
        -- Only groups that actually have old rows need a recent-row count,
        -- so this never touches the whole table when there is nothing to do.
        affected as (
            select distinct condo_id, listing_type from old_ranked
        ),
        recent_counts as (
            select p.condo_id, p.listing_type, count(*) as c
            from price_history p
            join affected a
              on a.condo_id = p.condo_id
             and a.listing_type = p.listing_type
            where p.captured_at >= v_cutoff
            group by p.condo_id, p.listing_type
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
            -- coalesce(recent, 0) + old_rn is the row's rank across the whole
            -- group; the newest p_keep_recent are never candidates.
            where coalesce(rc.c, 0) + o.old_rn > p_keep_recent
        )
        select id from candidates
        where month_rn > 1          -- month_rn = 1 survives as that month's point
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
