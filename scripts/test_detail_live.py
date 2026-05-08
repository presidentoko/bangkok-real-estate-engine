"""Live validation of hipflat_detail.parse_detail_html on a diverse sample.

Picks N random condo URLs from the DB across different khets, fetches each L3
page via nodriver, runs the parser, and reports completeness per building.

Usage:
  python scripts/test_detail_live.py [--n 7]

Browser window will open. Each page takes ~5-10s. Total ~1-2 min for n=7.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.hipflat_detail import fetch_detail  # noqa: E402

PROFILE_DIR = os.path.join(os.getcwd(), ".nodriver-profile")
PER_PAGE_DELAY_S = 6


def _pick_sample(n: int) -> list[dict]:
    """N condos from N distinct khets when possible."""
    c = get_client()
    rows = c.table("condos").select("id,name,url,region_id").eq(
        "source", "hipflat"
    ).execute().data
    by_region: dict = {}
    for r in rows:
        if not r.get("url"):
            continue
        by_region.setdefault(r.get("region_id"), []).append(r)
    # One random per region, then take up to n.
    sampled = [random.choice(group) for group in by_region.values() if group]
    random.shuffle(sampled)
    return sampled[:n]


async def _run(n: int) -> int:
    sample = _pick_sample(n)
    if not sample:
        logger.error("no hipflat condos with URL in DB")
        return 1
    logger.info(f"sampling {len(sample)} buildings across distinct khets")
    for s in sample:
        logger.info(f"  - {s['name']}  ({s['url']})")

    os.makedirs(PROFILE_DIR, exist_ok=True)
    save_dir = ROOT / "scripts" / "probes" / "live"
    save_dir.mkdir(parents=True, exist_ok=True)
    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_DIR,
        browser_args=["--lang=en-US"],
    )
    summary: list[dict] = []
    try:
        for i, row in enumerate(sample, 1):
            label = f"[{i}/{len(sample)}] {row['name'][:40]}"
            logger.info(f"{label} ...")
            slug = row["url"].rsplit("/", 1)[-1]
            save_path = save_dir / f"{slug}.html"
            parsed = await fetch_detail(row["url"], browser, label=label, save_html_to=str(save_path))
            if parsed is None:
                summary.append({"name": row["name"], "url": row["url"], "ok": False, "reason": "fetch_failed"})
            else:
                sig = parsed.get("_signal_completeness", {})
                summary.append({
                    "name": parsed.get("name") or row["name"],
                    "url": row["url"],
                    "ok": True,
                    "geo": sig.get("has_geo"),
                    "amenities_n": len(parsed.get("amenities") or []),
                    "transit_n": len(parsed.get("transit") or []),
                    "completion_year": parsed.get("completion_year"),
                    "floors": parsed.get("floors"),
                    "total_units": parsed.get("total_units"),
                    "price_range": (
                        f"{parsed.get('price_currency') or '?'}"
                        f"{parsed.get('price_min') or '?'}-{parsed.get('price_max') or '?'}"
                        f" ({parsed.get('price_period') or '?'})"
                    ) if sig.get("has_price_range") else None,
                })
            await asyncio.sleep(PER_PAGE_DELAY_S)
    finally:
        try:
            browser.stop()
        except Exception as e:
            logger.warning(f"browser.stop raised: {e}")

    print("\n" + "=" * 80)
    print("SAMPLE VALIDATION REPORT")
    print("=" * 80)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    n_ok = sum(1 for s in summary if s.get("ok"))
    n_geo = sum(1 for s in summary if s.get("geo"))
    n_amen = sum(1 for s in summary if (s.get("amenities_n") or 0) > 0)
    n_chars = sum(1 for s in summary if s.get("completion_year") and s.get("floors"))
    print(f"\nfetched ok: {n_ok}/{len(summary)}")
    print(f"  with geo: {n_geo}")
    print(f"  with amenities: {n_amen}")
    print(f"  with completion+floors: {n_chars}")
    return 0 if n_ok == len(summary) else 2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=7)
    args = ap.parse_args()
    return uc.loop().run_until_complete(_run(args.n))


if __name__ == "__main__":
    raise SystemExit(main())
