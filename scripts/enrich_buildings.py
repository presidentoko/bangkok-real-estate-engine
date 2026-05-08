"""Phase 2 Tier A — full enrichment of every hipflat building in DB.

Iterates `condos` where source='hipflat', fetches each L3 page via nodriver,
parses JSON-LD + section.* into Tier-A fields, and persists.

Resumable
---------
Skip rows where:
  - latitude IS NOT NULL                    (already geo-enriched), OR
  - detail_fetched_at > now() - 7 days      (recently refreshed).

Force a full re-enrich with --force.

Adaptive delay
--------------
Starts at PER_PAGE_DELAY_S, escalates if a fetch returns no parse-able HTML
(soft Cloudflare challenge re-fired). Resets after 5 consecutive successes.

Usage
-----
  python scripts/enrich_buildings.py                  # default — resume mode
  python scripts/enrich_buildings.py --limit 50       # stop after N buildings
  python scripts/enrich_buildings.py --force          # re-fetch even if done
  python scripts/enrich_buildings.py --skip-id <id>   # ban a specific id
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client, persist_detail  # noqa: E402
from src.scrapers.hipflat_detail import fetch_detail  # noqa: E402

PROFILE_DIR = os.path.join(os.getcwd(), ".nodriver-profile")
DEFAULT_DELAY_S = 5
MAX_DELAY_S = 60
RESET_AFTER_SUCCESSES = 5
SKIP_IF_FETCHED_WITHIN_DAYS = 7


def _load_targets(force: bool) -> list[dict]:
    c = get_client()
    q = c.table("condos").select(
        "id,name,url,latitude,detail_fetched_at"
    ).eq("source", "hipflat")
    rows = q.execute().data or []
    if force:
        return [r for r in rows if r.get("url")]
    cutoff = datetime.now(timezone.utc) - timedelta(days=SKIP_IF_FETCHED_WITHIN_DAYS)
    out = []
    for r in rows:
        if not r.get("url"):
            continue
        if r.get("latitude") is not None:
            continue
        fetched = r.get("detail_fetched_at")
        if fetched:
            try:
                t = datetime.fromisoformat(fetched.replace("Z", "+00:00"))
                if t > cutoff:
                    continue
            except Exception:
                pass
        out.append(r)
    return out


async def _run(limit: int | None, force: bool) -> int:
    targets = _load_targets(force)
    if limit:
        targets = targets[:limit]
    if not targets:
        logger.info("nothing to enrich (all buildings already have lat/lng)")
        return 0
    logger.info(f"enriching {len(targets)} buildings (force={force}, limit={limit})")

    os.makedirs(PROFILE_DIR, exist_ok=True)
    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_DIR,
        browser_args=["--lang=en-US"],
    )
    client = get_client()

    delay = DEFAULT_DELAY_S
    consecutive_ok = 0
    n_ok = n_partial = n_fail = 0
    started = time.time()

    try:
        for i, row in enumerate(targets, 1):
            label = f"[{i}/{len(targets)}] {row['name'][:40]}"
            try:
                parsed = await fetch_detail(row["url"], browser, label=label)
            except Exception as e:
                logger.warning(f"{label} fetch raised: {e}")
                parsed = None

            if parsed is None:
                n_fail += 1
                consecutive_ok = 0
                delay = min(MAX_DELAY_S, delay * 2)
                logger.warning(f"{label} FAIL  (delay → {delay}s)")
            else:
                sig = parsed.get("_signal_completeness", {})
                if not sig.get("has_geo"):
                    n_partial += 1
                    logger.warning(f"{label} no-geo (partial parse)")
                else:
                    n_ok += 1
                try:
                    persist_detail(client, row["id"], parsed)
                except Exception as e:
                    n_fail += 1
                    logger.error(f"{label} persist failed: {e}")
                else:
                    consecutive_ok += 1
                    if consecutive_ok >= RESET_AFTER_SUCCESSES and delay > DEFAULT_DELAY_S:
                        old = delay
                        delay = max(DEFAULT_DELAY_S, delay // 2)
                        logger.info(f"  cooled down: {old}s → {delay}s after {consecutive_ok} ok")

            if i % 25 == 0 or i == len(targets):
                elapsed = time.time() - started
                rate = i / max(elapsed, 1)
                eta = (len(targets) - i) / max(rate, 0.001)
                logger.info(
                    f"progress {i}/{len(targets)}  "
                    f"ok={n_ok} partial={n_partial} fail={n_fail}  "
                    f"rate={rate:.2f}/s  eta={eta/60:.1f}min  delay={delay}s"
                )

            await asyncio.sleep(delay)
    finally:
        try:
            browser.stop()
        except Exception as e:
            logger.warning(f"browser.stop raised: {e}")

    elapsed = time.time() - started
    logger.info(
        f"DONE in {elapsed/60:.1f} min — ok={n_ok} partial={n_partial} fail={n_fail}"
    )
    return 0 if n_fail == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    return uc.loop().run_until_complete(_run(args.limit, args.force))


if __name__ == "__main__":
    raise SystemExit(main())
