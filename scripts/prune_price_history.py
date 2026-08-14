"""Prune unbounded growth in price_history / condo_market_chart / underpriced_alerts.

Investigation (read every reader of these tables in web/ and src/ before
picking a retention rule — see below for what was found):

price_history readers
----------------------
  - web/app/[lang]/reality/[id]/page.tsx: pulls the FULL sale-only history
    for a single condo_id, ordered by captured_at ascending (no LIMIT), to
    draw the "reality" price trend chart. Needs a long history, but a trend
    chart doesn't need weekly resolution once a point is 6+ months old —
    monthly resolution is visually indistinguishable at that range.
  - web/lib/queries/rag.ts: only the most recent 500 rows with a non-null
    delta_pct (recent-movers panel) — needs only the last snapshot batch.
  - scripts/snapshot_prices.py / src/analysis/price_movers.py: only the
    single most recent captured_at batch (prior-snapshot delta calc /
    weekly Telegram digest).
  - scripts/rematch_listings.py: bulk re-points condo_id on a manual
    orphan-merge repair (rare, operator-triggered) — unaffected by
    pruning granularity as long as rows aren't deleted mid-merge.

  => Retention: always keep the most recent 2 captured_at snapshots per
     (condo_id, listing_type) regardless of age (covers the digest/delta
     readers and any condo that's stopped being scraped every run). Within
     the last RETENTION_MONTHS (default 6) keep full weekly resolution (the
     reality-page chart wants a readable recent trend). Beyond that, keep
     at most one row per (condo_id, listing_type, calendar month) — thins
     the old tail of the chart to monthly points without flattening the
     line to nothing.

condo_market_chart readers
---------------------------
  - web/app/[lang]/condo/[slug]/page.tsx: reads up to 200 rows for a
    condo_id ordered by year_month ascending — WITHOUT filtering by
    captured_at. Per persist_detail_b()'s own comment in src/db.py, every
    Tier-B re-visit INSERTs a brand-new set of rows with a fresh
    captured_at rather than replacing the prior batch, so this page is
    silently mixing points from multiple stale scrapes into the same
    200-row window today.
  - web/app/[lang]/data/page.tsx: COUNT only (site-wide stats tile).

  => Retention: keep only the most recent 2 distinct captured_at batches
     per condo_id, delete every row from older batches. This bounds growth
     AND removes the duplicate/stale points the condo page was
     unknowingly rendering.

underpriced_alerts
-------------------
  Dedup window (7 days) equals the run cadence, so a persistently
  underpriced condo accumulates a new alert row every week forever. Low
  volume today (372 rows) — a simple age cutoff is enough.

Dry-run by default (mirrors mark_stale_listings.py's CLI convention). Pass
--apply to actually delete. Deletes are chunked (id lists of DELETE_CHUNK)
the same way mark_stale_listings.py chunks its updates.

Usage:
  python scripts/prune_price_history.py                         # dry-run, all three
  python scripts/prune_price_history.py --apply
  python scripts/prune_price_history.py --skip-chart --skip-alerts
  python scripts/prune_price_history.py --months 6 --keep-recent 2 --apply
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402


PAGE = 1000
DELETE_CHUNK = 200
# Rows deleted per RPC call. Small enough that one statement stays well inside
# PostgREST's timeout, large enough that a big backlog clears in a few calls.
PRUNE_BATCH = 20000

DEFAULT_RETENTION_MONTHS = 6
DEFAULT_KEEP_RECENT = 2
DEFAULT_ALERT_MAX_AGE_DAYS = 90


def _fetch_all(client, table: str, columns: str, *, order_by: str = "id") -> list[dict]:
    """Paginate a select() — PostgREST caps every response at 1000 rows
    regardless of table size. order_by the PK is required for stable
    pagination across separate .range() requests."""
    out: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table(table)
            .select(columns)
            .order(order_by)
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        ) or []
        out.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    return out


def _parse_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _chunked_delete(client, table: str, ids: list, *, id_column: str = "id") -> None:
    for i in range(0, len(ids), DELETE_CHUNK):
        chunk = ids[i:i + DELETE_CHUNK]
        client.table(table).delete(returning="minimal").in_(id_column, chunk).execute()


def _verify_against_python(
    client, *, table: str, columns: str, sql_fn: str, params: dict, python_fn
) -> None:
    """Assert migration 016's SQL picks exactly the same rows as the Python
    reference below.

    The Python implementations are no longer what runs — the SQL functions
    are — but they stay as the executable specification of the retention
    rules, and this compares the two on real data. It costs the full table
    read the SQL version exists to avoid, so it is opt-in (--verify), meant
    for after a rule change rather than for the scheduled job.

    Comparing at the default retention proves little while nothing is old
    enough to prune (on 2026-08-13, zero of 861,148 price_history rows were
    past the 6-month window), so callers should also verify at a shortened
    window where both sides have real work to do.
    """
    logger.info(f"[verify] loading {table} for the Python reference...")
    rows = _fetch_all(client, table, columns)
    expected = len(python_fn(rows))
    actual = int(client.rpc(sql_fn, {**params, "p_dry_run": True}).execute().data or 0)
    # The SQL side is batched, so a backlog bigger than one batch legitimately
    # reports less than the reference. Only an over-delete is a real mismatch.
    capped = min(expected, params.get("p_batch_size", PRUNE_BATCH))
    if actual != capped:
        raise SystemExit(
            f"[verify] MISMATCH on {table}: python={expected} "
            f"(capped to {capped}) vs sql={actual}. Refusing to continue."
        )
    logger.info(f"[verify] {table}: python and sql agree on {actual} rows")


# ─────────────────────────────────────────────────────────────────────
# price_history
# ─────────────────────────────────────────────────────────────────────


def compute_price_history_deletions(
    rows: list[dict],
    *,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    retention_months: int = DEFAULT_RETENTION_MONTHS,
) -> list[int]:
    """Pure function (no DB) so the retention logic can be unit-tested.

    rows: [{"id", "condo_id", "listing_type", "captured_at"}, ...]
    Returns the list of price_history ids to delete.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=retention_months * 30)

    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        groups[(r["condo_id"], r["listing_type"])].append(r)

    delete_ids: list[int] = []
    for _key, grp in groups.items():
        grp.sort(key=lambda r: r["captured_at"], reverse=True)
        keep_ids = {r["id"] for r in grp[:keep_recent]}

        seen_months: set[tuple[int, int]] = set()
        for r in grp[keep_recent:]:
            if r["id"] in keep_ids:
                continue
            ts = _parse_ts(r["captured_at"])
            if ts is None or ts >= cutoff:
                # Inside the full-resolution retention window — keep as-is.
                continue
            ym = (ts.year, ts.month)
            if ym not in seen_months:
                # First (= most recent, since sorted desc) row seen for this
                # calendar month becomes that month's representative.
                seen_months.add(ym)
                continue
            delete_ids.append(r["id"])
    return delete_ids


def _rpc_prune(client, fn: str, params: dict, *, dry_run: bool) -> int:
    """Drive one of migration 016's prune functions until it stops finding rows.

    Each call deletes at most p_batch_size rows and returns how many it took,
    so no single statement runs long enough to hit PostgREST's timeout — the
    trap recompute_region_averages() fell into (57014, whole transaction
    rolled back). A dry run asks once and deletes nothing.
    """
    if dry_run:
        return int(client.rpc(fn, {**params, "p_dry_run": True}).execute().data or 0)
    total = 0
    while True:
        n = int(client.rpc(fn, {**params, "p_dry_run": False}).execute().data or 0)
        total += n
        if n == 0:
            return total
        logger.info(f"  {fn}: deleted {n} (running total {total})")


def prune_price_history(
    client, *, keep_recent: int, retention_months: int, dry_run: bool, verify: bool
) -> int:
    """Delete via SQL. `verify` additionally runs the Python reference logic
    and asserts the two agree.

    This used to load the whole table (861,148 rows, 137 B/row = 113 MB of
    egress) purely to choose ids, and at the time of the change it was
    choosing none of them — no row was yet older than the 6-month window.
    """
    params = {
        "p_keep_recent": keep_recent,
        "p_retention_months": retention_months,
        "p_batch_size": PRUNE_BATCH,
    }
    if verify:
        _verify_against_python(
            client,
            table="price_history",
            columns="id, condo_id, listing_type, captured_at",
            sql_fn="prune_price_history",
            params=params,
            python_fn=lambda rows: compute_price_history_deletions(
                rows, keep_recent=keep_recent, retention_months=retention_months
            ),
        )

    n = _rpc_prune(client, "prune_price_history", params, dry_run=dry_run)
    verb = "would delete" if dry_run else "deleted"
    logger.info(
        f"price_history: {verb} {n} rows "
        f"(keep-recent={keep_recent}, monthly-thin-beyond={retention_months}mo)"
    )
    return n


# ─────────────────────────────────────────────────────────────────────
# condo_market_chart
# ─────────────────────────────────────────────────────────────────────


def compute_chart_deletions(rows: list[dict], *, keep_recent: int = DEFAULT_KEEP_RECENT) -> list[int]:
    """rows: [{"id", "condo_id", "captured_at"}, ...]. Returns ids to delete —
    every row NOT part of a condo's most recent `keep_recent` distinct
    captured_at batches."""
    captured_by_condo: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        captured_by_condo[r["condo_id"]].add(r["captured_at"])

    keep_captured: dict[str, set[str]] = {}
    for condo_id, captured_set in captured_by_condo.items():
        keep_captured[condo_id] = set(sorted(captured_set, reverse=True)[:keep_recent])

    delete_ids: list[int] = []
    for r in rows:
        if r["captured_at"] not in keep_captured.get(r["condo_id"], set()):
            delete_ids.append(r["id"])
    return delete_ids


def prune_condo_market_chart(
    client, *, keep_recent: int, dry_run: bool, verify: bool
) -> int:
    params = {"p_keep_recent": keep_recent, "p_batch_size": PRUNE_BATCH}
    if verify:
        _verify_against_python(
            client,
            table="condo_market_chart",
            columns="id, condo_id, captured_at",
            sql_fn="prune_condo_market_chart",
            params=params,
            python_fn=lambda rows: compute_chart_deletions(rows, keep_recent=keep_recent),
        )
    n = _rpc_prune(client, "prune_condo_market_chart", params, dry_run=dry_run)
    verb = "would delete" if dry_run else "deleted"
    logger.info(
        f"condo_market_chart: {verb} {n} rows "
        f"(keeping the most recent {keep_recent} captured_at batches per condo)"
    )
    return n


# ─────────────────────────────────────────────────────────────────────
# underpriced_alerts
# ─────────────────────────────────────────────────────────────────────


def prune_underpriced_alerts(client, *, max_age_days: int, dry_run: bool) -> int:
    n = _rpc_prune(
        client,
        "prune_underpriced_alerts",
        {"p_max_age_days": max_age_days, "p_batch_size": PRUNE_BATCH},
        dry_run=dry_run,
    )
    verb = "would delete" if dry_run else "deleted"
    logger.info(f"underpriced_alerts: {verb} {n} rows (older than {max_age_days}d)")
    return n


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                     help="Write deletes. Without this, dry-run only.")
    ap.add_argument("--months", type=int, default=DEFAULT_RETENTION_MONTHS,
                     help=f"price_history: thin to 1 row/month beyond this age (default {DEFAULT_RETENTION_MONTHS})")
    ap.add_argument("--keep-recent", type=int, default=DEFAULT_KEEP_RECENT,
                     help=f"Always keep this many most-recent snapshots/batches per condo (default {DEFAULT_KEEP_RECENT})")
    ap.add_argument("--alert-max-age-days", type=int, default=DEFAULT_ALERT_MAX_AGE_DAYS,
                     help=f"underpriced_alerts: delete rows older than this (default {DEFAULT_ALERT_MAX_AGE_DAYS})")
    ap.add_argument("--verify", action="store_true",
                     help="Cross-check the SQL prune against the Python reference "
                          "logic. Costs a full table read — use after a rule change, "
                          "not in the scheduled job.")
    ap.add_argument("--skip-price-history", action="store_true")
    ap.add_argument("--skip-chart", action="store_true")
    ap.add_argument("--skip-alerts", action="store_true")
    args = ap.parse_args()
    dry_run = not args.apply

    client = get_client()

    total = 0
    if not args.skip_price_history:
        logger.info("=== price_history retention ===")
        total += prune_price_history(
            client,
            keep_recent=args.keep_recent,
            retention_months=args.months,
            dry_run=dry_run,
            verify=args.verify,
        )

    if not args.skip_chart:
        logger.info("\n=== condo_market_chart retention ===")
        total += prune_condo_market_chart(
            client, keep_recent=args.keep_recent, dry_run=dry_run, verify=args.verify
        )

    if not args.skip_alerts:
        logger.info("\n=== underpriced_alerts retention ===")
        total += prune_underpriced_alerts(
            client, max_age_days=args.alert_max_age_days, dry_run=dry_run
        )

    if dry_run:
        logger.info(f"\nDRY-RUN — {total} rows would be deleted across all tables. Pass --apply to commit.")
    else:
        logger.info(f"\nDone. {total} rows deleted across all tables.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
