-- Drop indexes that cost disk and do nothing. Run 2026-09-15 by hand in the
-- SQL Editor (no DB URL in the repo), with the project at 0.469 of the Free
-- plan's 0.5GB database size.
--
-- Chosen from pg_stat_user_indexes on the migrated project (stats since
-- 2026-07-13) plus a read of every writer and reader in src/, scripts/ and
-- web/. Kept: every primary key, every unique index an upsert names in
-- on_conflict, and condo_neighbours_uniq (src/db.py re-inserts neighbours
-- and relies on it to reject a duplicate).
--
-- Zero scans since migration:
--   listings_scraped_idx        20 MB  (scraped_at desc) -- the latest-listing
--                                      views order by (condo_id, scraped_at),
--                                      which listings_sale_latest_idx serves
--   condo_market_chart_uniq     21 MB  unique incl. captured_at; src/db.py
--                                      plain-inserts every Tier B batch with
--                                      a fresh captured_at, so it never trips
--   listings_first_seen_idx    9.5 MB  first_seen_at is read per condo_id only
--   condos_geo_idx, condos_tier_b_fetched_idx, condos_detail_fetched_idx,
--   condos_aqi_idx, condo_amenities_name_idx, condo_neighbours_slug_idx
--                             ~2.5 MB together
--
-- Used, but a strict prefix of a unique index on the same table:
--   listings_condo_idx         4.9 MB  (condo_id) <- listings_condo_unit_uniq
--                                      (condo_id, source, source_unit_id)
--   condos_slug_idx            2.1 MB  (slug) <- condos_slug_unique, partial
--                                      on slug is not null, which every
--                                      slug = ... lookup satisfies

drop index if exists listings_scraped_idx;
drop index if exists listings_first_seen_idx;
drop index if exists listings_condo_idx;

alter table condo_market_chart drop constraint if exists condo_market_chart_uniq;
drop index if exists condo_market_chart_uniq;

drop index if exists condos_slug_idx;
drop index if exists condos_geo_idx;
drop index if exists condos_tier_b_fetched_idx;
drop index if exists condos_detail_fetched_idx;
drop index if exists condos_aqi_idx;
drop index if exists condo_amenities_name_idx;
drop index if exists condo_neighbours_slug_idx;
