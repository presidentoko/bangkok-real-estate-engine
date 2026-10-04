"""Null the cam_fee_per_month values that are not a monthly fee.

The FazWaz chip this column comes from has carried three different things:
a monthly fee for one unit (what we want), a per-sqm rate (฿35), and — where
the markup shifted — a price (฿20,199,600 "per month"). Measured 2026-10-04
across the 3,076 buildings with a value: 106 below ฿200, 2,896 inside the
band, 74 above ฿60,000. The worst 45 were rendering on live condo pages.

src/scrapers/fazwaz.py now drops out-of-band readings at capture, and
web/lib/camFee.ts filters them at render. This clears what is already stored
so the column itself stops lying.

    python scripts/clean_cam_fees.py            # dry run
    python scripts/clean_cam_fees.py --apply
"""
from __future__ import annotations

import argparse
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.fazwaz import CAM_FEE_MAX, CAM_FEE_MIN  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write (default: dry run)")
    args = ap.parse_args()

    client = get_client()
    rows: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table("condos")
            .select("id, name, cam_fee_per_month")
            .not_.is_("cam_fee_per_month", "null")
            .order("id")
            .range(offset, offset + 999)
            .execute()
            .data
        ) or []
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000

    bad = [
        r
        for r in rows
        if not (CAM_FEE_MIN <= float(r["cam_fee_per_month"]) <= CAM_FEE_MAX)
    ]
    logger.info(f"{len(bad)} of {len(rows)} cam_fee_per_month values are out of band")
    for r in sorted(bad, key=lambda r: -float(r["cam_fee_per_month"]))[:10]:
        logger.info(f"  {r['name'][:40]:42} {r['cam_fee_per_month']}")

    if not args.apply:
        logger.info("dry run — pass --apply to null these")
        return 0

    for i in range(0, len(bad), 50):
        for r in bad[i : i + 50]:
            client.table("condos").update({"cam_fee_per_month": None}).eq("id", r["id"]).execute()
    logger.info(f"nulled {len(bad)} values")
    return 0


if __name__ == "__main__":
    sys.exit(main())
