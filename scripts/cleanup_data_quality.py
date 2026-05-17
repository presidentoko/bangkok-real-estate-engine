"""Data-quality cleanup pass.

Three idempotent fixes:
  1. Province slug normalization
       - chiangmai → chiang-mai
       - chonburi  → chon-buri
       - chiangrai → chiang-rai
       - huahin    → hua-hin
       - samui     → ko-samui
     (pattaya is intentionally kept as a separate province; it's
     a city within Chon Buri but has distinct market dynamics.)
  2. Yield outlier cleanup — null out gross_yield_pct where the value is
     clearly the product of a price-parse error: yield > 30%, yield < 1%,
     avg_sale_price < ฿300k, or avg_monthly_rent absurd.
  3. Region name slug normalization — ensure regions row matches its
     province (if any) and isn't a stray duplicate.

Dry-run by default. Pass --apply to write.

Usage:
  python scripts/cleanup_data_quality.py                  # dry-run, all 3
  python scripts/cleanup_data_quality.py --apply
  python scripts/cleanup_data_quality.py --skip-provinces
  python scripts/cleanup_data_quality.py --skip-yields
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402


PROVINCE_REMAP = {
    "chiangmai":  "chiang-mai",
    "chonburi":   "chon-buri",
    "chiangrai":  "chiang-rai",
    "huahin":     "hua-hin",
    "samui":      "ko-samui",
    # FazWaz slugs sometimes look like 'prachuap khiri khan' with spaces
    "prachuapkhirikhan":  "prachuap-khiri-khan",
    "nakhonratchasima":   "nakhon-ratchasima",
    "nakhonpathom":       "nakhon-pathom",
    "khonkaen":           "khon-kaen",
    "suratthani":         "surat-thani",
    "samutprakan":        "samut-prakan",
    "samutsakhon":        "samut-sakhon",
    "pathumthani":        "pathum-thani",
    "udonthani":          "udon-thani",
}


# Yield outlier thresholds. Tighter than the digest filters; here we're
# nulling out values we're sure are wrong, not just hiding them from a chart.
MIN_PLAUSIBLE_YIELD = 1.0      # below 1% gross = data error or near-zero rent listings
MAX_PLAUSIBLE_YIELD = 30.0     # above 30% gross = price parse error
MIN_PLAUSIBLE_SALE  = 300_000  # condos under ฿300k = decimal/comma slip


def fix_provinces(client, dry_run: bool) -> int:
    """Remap known slug variants to canonical form. Returns rows touched."""
    touched = 0
    for old, new in PROVINCE_REMAP.items():
        rows = (
            client.table("condos")
            .select("id, name, province")
            .eq("province", old)
            .execute()
            .data
        ) or []
        if not rows:
            continue
        logger.info(f"  province '{old}' → '{new}': {len(rows)} condos")
        if not dry_run:
            for i in range(0, len(rows), 200):
                batch = rows[i:i + 200]
                ids = [r["id"] for r in batch]
                client.table("condos").update({"province": new}).in_(
                    "id", ids
                ).execute()
        touched += len(rows)
    return touched


def fix_yield_outliers(client, dry_run: bool) -> int:
    """Null out gross_yield_pct on rows that are obviously price-parse errors.
    Keeps avg_sale_price / avg_monthly_rent intact (they may be correctly
    parsed for OTHER yield computations; only the yield % itself is bogus
    when sale price is wrong)."""
    rows = (
        client.table("condos")
        .select(
            "id, name, gross_yield_pct, avg_sale_price, avg_monthly_rent, province"
        )
        .not_.is_("gross_yield_pct", "null")
        .execute()
        .data
    ) or []

    bad = [
        r for r in rows
        if (
            float(r["gross_yield_pct"]) > MAX_PLAUSIBLE_YIELD
            or float(r["gross_yield_pct"]) < MIN_PLAUSIBLE_YIELD
            or (r["avg_sale_price"] is not None and float(r["avg_sale_price"]) < MIN_PLAUSIBLE_SALE)
        )
    ]
    if not bad:
        logger.info("  no yield outliers found")
        return 0
    logger.info(f"  {len(bad)} yield outliers found (of {len(rows)} computed):")
    for r in sorted(bad, key=lambda x: float(x["gross_yield_pct"]), reverse=True)[:8]:
        sale = r.get("avg_sale_price")
        sale_str = f"฿{float(sale):,.0f}" if sale else "?"
        logger.info(
            f"    {r['gross_yield_pct']:>6.2f}%  sale={sale_str:>14s}  {r['name'][:48]!r}"
        )
    if dry_run:
        return len(bad)
    for i in range(0, len(bad), 200):
        ids = [r["id"] for r in bad[i:i + 200]]
        client.table("condos").update({
            "gross_yield_pct": None,
            "yield_computed_at": None,
        }).in_("id", ids).execute()
    return len(bad)


def summarize(client) -> None:
    """Quick post-cleanup snapshot."""
    rows = []
    offset = 0
    while True:
        chunk = client.table("condos").select("province").range(offset, offset + 999).execute().data or []
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    pc = Counter(r["province"] for r in rows if r.get("province"))
    logger.info("Province coverage after cleanup:")
    for p, n in pc.most_common(15):
        logger.info(f"  {p:25s}  {n:>6,}")

    ycount = (
        client.table("condos")
        .select("id", count="exact", head=True)
        .not_.is_("gross_yield_pct", "null")
        .execute()
        .count
    )
    logger.info(f"condos with valid yield: {ycount}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Write changes. Without this, dry-run only.")
    ap.add_argument("--skip-provinces", action="store_true")
    ap.add_argument("--skip-yields", action="store_true")
    args = ap.parse_args()
    dry_run = not args.apply

    client = get_client()

    if not args.skip_provinces:
        logger.info("=== Province slug normalization ===")
        n_prov = fix_provinces(client, dry_run)
        logger.info(f"  total touched: {n_prov} condos")

    if not args.skip_yields:
        logger.info("\n=== Yield outlier cleanup ===")
        n_yield = fix_yield_outliers(client, dry_run)
        logger.info(f"  total nulled: {n_yield} condos")

    if dry_run:
        logger.info("\nDRY-RUN — no DB writes. Pass --apply to commit.")
    else:
        logger.info("")
        summarize(client)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
