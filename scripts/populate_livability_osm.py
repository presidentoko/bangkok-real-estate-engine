"""Populate livability_metrics from OSM Overpass.

Mirrors src/analysis/livability.py but:
  - Paginates the condos query (Supabase REST caps at 1000/req)
  - Resumable: skip rows that already have hospitals_within_1km set
    (FAQ-derived rows from populate_livability_from_transit.py only set
    BTS/MRT placeholders, not hospital counts — so they get refreshed)
  - Adds a checkpoint log every N rows for long-running progress

Cost: ~1.2s/building × ~1000 buildings = ~20 min. Free, no API key.

Usage:
  python scripts/populate_livability_osm.py
  python scripts/populate_livability_osm.py --limit 50
  python scripts/populate_livability_osm.py --force      # re-fetch all
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx  # noqa: E402
from loguru import logger  # noqa: E402

from src.analysis.livability import (  # noqa: E402
    OVERPASS_RATE_LIMIT_SEC,
    OVERPASS_TIMEOUT,
    _overpass_query,
    _score,
    _summarise_overpass,
)
from src.db import get_client  # noqa: E402

PAGE = 1000
# Overpass public instance is rate-limited and shared; bump base delay above
# the documented 1 req/s and back off if we still get 429.
BASE_DELAY_S = 2.5
MAX_DELAY_S = 60
RESET_AFTER_OK = 8


def _load_targets(client, force: bool, sources: list[str] | None, provinces: list[str] | None) -> list[dict]:
    out: list[dict] = []
    offset = 0
    while True:
        q = (
            client.table("condos")
            .select("id, latitude, longitude")
            .eq("published", True)
            .not_.is_("latitude", "null")
        )
        if sources:
            q = q.in_("source", sources)
        if provinces:
            q = q.in_("province", provinces)
        page = (
            q.range(offset, offset + PAGE - 1)
            .execute()
            .data
        ) or []
        out.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    if force:
        return out

    # Skip rows with hospitals_within_1km set (a real OSM count signal,
    # whereas FAQ-derived placeholder rows have only stations + 800m distance).
    existing = set()
    offset = 0
    while True:
        page = (
            client.table("livability_metrics")
            .select("condo_id, hospitals_within_1km")
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        ) or []
        for r in page:
            if r.get("hospitals_within_1km") is not None:
                existing.add(r["condo_id"])
        if len(page) < PAGE:
            break
        offset += PAGE
    return [r for r in out if r["id"] not in existing]


async def _run(limit: int | None, force: bool, sources: list[str] | None, provinces: list[str] | None) -> int:
    client = get_client()
    targets = _load_targets(client, force, sources, provinces)
    if limit:
        targets = targets[:limit]
    if not targets:
        logger.info("nothing to fetch — every geo-located condo has OSM signal")
        return 0
    logger.info(f"OSM Overpass pass for {len(targets)} condos")

    started = time.time()
    n_ok = n_fail = 0
    delay = BASE_DELAY_S
    consecutive_ok = 0
    async with httpx.AsyncClient(timeout=OVERPASS_TIMEOUT + 10) as http:
        for i, r in enumerate(targets, 1):
            cid, lat, lng = r["id"], r["latitude"], r["longitude"]
            success = False
            for attempt in range(4):
                try:
                    payload = await _overpass_query(http, lat, lng)
                    success = True
                    break
                except httpx.HTTPStatusError as e:
                    code = e.response.status_code
                    if code in (429, 504):
                        # Honour Retry-After when the server sets it; else exp backoff.
                        ra = e.response.headers.get("Retry-After")
                        wait = float(ra) if ra and ra.isdigit() else min(MAX_DELAY_S, delay * (2 ** attempt))
                        logger.warning(
                            f"[{i}/{len(targets)}] {code} — backing off {wait:.0f}s (attempt {attempt+1}/4)"
                        )
                        await asyncio.sleep(wait)
                        delay = min(MAX_DELAY_S, max(delay, wait))
                        consecutive_ok = 0
                        continue
                    logger.warning(f"[{i}/{len(targets)}] {cid}: {e}")
                    break
                except Exception as e:
                    logger.warning(f"[{i}/{len(targets)}] {cid}: {e}")
                    break
            if not success:
                n_fail += 1
                await asyncio.sleep(delay)
                continue

            try:
                summary = _summarise_overpass(payload, lat, lng)
                client.table("livability_metrics").upsert({
                    "condo_id": cid,
                    "nearest_bts_distance_m": summary["bts_m"],
                    "nearest_bts_station": summary["bts_name"],
                    "nearest_mrt_distance_m": summary["mrt_m"],
                    "nearest_mrt_station": summary["mrt_name"],
                    "hospitals_within_1km": summary["hospitals"],
                    "schools_within_1km": summary["schools"],
                    "supermarkets_within_1km": summary["supermarkets"],
                    "livability_score": _score(
                        summary["bts_m"], summary["mrt_m"],
                        summary["hospitals"], summary["schools"],
                        summary["supermarkets"],
                    ),
                }, on_conflict="condo_id").execute()
                n_ok += 1
                consecutive_ok += 1
                if consecutive_ok >= RESET_AFTER_OK and delay > BASE_DELAY_S:
                    old = delay
                    delay = max(BASE_DELAY_S, delay / 2)
                    logger.info(f"  cooled down: {old:.1f}s → {delay:.1f}s")
            except Exception as e:
                n_fail += 1
                logger.warning(f"[{i}/{len(targets)}] persist failed: {e}")

            if i % 25 == 0 or i == len(targets):
                elapsed = time.time() - started
                rate = i / max(elapsed, 1)
                eta = (len(targets) - i) / max(rate, 0.001)
                logger.info(
                    f"progress {i}/{len(targets)}  ok={n_ok} fail={n_fail}  "
                    f"rate={rate:.2f}/s  eta={eta/60:.1f}min  delay={delay:.1f}s"
                )

            await asyncio.sleep(delay)

    elapsed = time.time() - started
    logger.info(f"DONE in {elapsed/60:.1f} min — ok={n_ok} fail={n_fail}")
    return 0 if n_fail == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    ap.add_argument(
        "--sources", nargs="+", default=None,
        help="Restrict to these condo sources (e.g. fazwaz dotproperty "
             "ddproperty). Omit to target every published geo-located condo.",
    )
    ap.add_argument(
        "--province", nargs="+", default=None,
        help="Restrict to these province slugs (e.g. phuket pattaya huahin). "
             "Accepts both compact and kebab forms.",
    )
    args = ap.parse_args()
    return asyncio.run(_run(args.limit, args.force, args.sources, args.province))


if __name__ == "__main__":
    raise SystemExit(main())
