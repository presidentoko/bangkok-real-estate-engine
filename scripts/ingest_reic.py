"""Sweep REIC research reports from /Research/REICReport/{id}.

Anonymous (no login). Walks a numeric ID range, fetches each page, parses
title/summary/date/category/region, upserts into reic_reports.

This is the *structural* layer — title + raw summary text. A separate
LLM-extraction pass (TODO: scripts/extract_reic_numbers.py) turns the
narrative into structured numeric fields (price_index, YoY %, supply units,
absorption %).

Usage:
  python scripts/ingest_reic.py                      # default 1700..1940
  python scripts/ingest_reic.py --from 1800 --to 1940
  python scripts/ingest_reic.py --delay-s 1.5
  python scripts/ingest_reic.py --dry-run
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.reic import fetch_report  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="id_from", type=int, default=1700)
    ap.add_argument("--to",   dest="id_to",   type=int, default=1940)
    ap.add_argument("--delay-s", type=float, default=1.0,
                    help="Politeness delay between fetches (default 1s)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    client = get_client()
    stats = Counter()
    rows: list[dict] = []
    started = time.time()

    with httpx.Client() as http:
        for rid in range(args.id_from, args.id_to + 1):
            try:
                rep = fetch_report(http, rid)
            except Exception as e:
                logger.warning(f"  {rid}: {e}")
                stats["error"] += 1
                continue
            if not rep:
                stats["missing"] += 1
                time.sleep(args.delay_s)
                continue
            if not rep.get("title"):
                stats["no_title"] += 1
                time.sleep(args.delay_s)
                continue

            stats["ok"] += 1
            rows.append(rep)
            if stats["ok"] % 10 == 0:
                logger.info(
                    f"  [{rid}] ok={stats['ok']} missing={stats['missing']} "
                    f"elapsed={(time.time()-started)/60:.1f}min  · {rep['title'][:60]!r}"
                )
            time.sleep(args.delay_s)

    logger.info(f"\nFetched {len(rows)} reports in {(time.time()-started)/60:.1f} min  {dict(stats)}")

    if rows:
        by_cat = Counter((r.get("category") or "—") for r in rows)
        by_reg = Counter((r.get("region")   or "—") for r in rows)
        logger.info(f"Categories: {dict(by_cat)}")
        logger.info(f"Regions:    {dict(by_reg)}")

    if args.dry_run:
        logger.info("--dry-run: no DB writes")
        # Print a few samples
        for r in rows[:5]:
            logger.info(
                f"  · {r['reic_id']}  {r['published_at'] or '?'}  "
                f"[{r.get('region','?')}/{r.get('category','?')}]  {r['title'][:80]!r}"
            )
        return 0

    # Upsert in batches
    written = 0
    for i in range(0, len(rows), 100):
        batch = rows[i:i + 100]
        client.table("reic_reports").upsert(
            batch, on_conflict="reic_id"
        ).execute()
        written += len(batch)
        logger.info(f"  upserted {written}/{len(rows)}")
    logger.info(f"Done. {written} reports stored.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
