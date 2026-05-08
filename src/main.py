"""Pipeline entry: scrape Bangkok-wide → persist → analyse → report.

Scrapers now hit a single Bangkok-wide search URL per source. District is
extracted post-hoc by db.upsert_condo via util.district, so regional averages
aggregate per khet automatically.
"""
from __future__ import annotations

import asyncio
import sys

from loguru import logger

from src.analysis.bubble_index import compute_bubble_indices
from src.analysis.livability import compute_livability
from src.analysis.risk import compute_risk
from src.analysis.super_value import compute_super_value
from src.analysis.underpriced import detect_underpriced
from src.config import get_settings
from src.db import (
    append_price_history,
    get_client,
    insert_listing,
    recompute_region_averages,
    upsert_condo,
)
from src.notifiers.dispatcher import dispatch_alerts
from src.reports.generator import generate_reports
from src.scrapers import hipflat


MAX_LISTINGS_PER_SOURCE = 150


async def _run_scraper(scraper_module, supabase, label: str, cap: int) -> int:
    count = 0
    async for item in scraper_module.scrape(cap):
        try:
            cid = upsert_condo(supabase, item)
            insert_listing(supabase, cid, item)
            append_price_history(supabase, cid, item)
            count += 1
        except Exception as e:
            logger.warning(
                f"[{label}] persist failed for "
                f"{item.get('source_listing_id')}: {e}"
            )
    return count


async def main() -> None:
    s = get_settings()
    logger.remove()
    logger.add(sys.stderr, level=s.log_level)
    supabase = get_client()

    logger.info(f"=== STAGE 1: scrape (cap={MAX_LISTINGS_PER_SOURCE} per source) ===")
    totals: dict[str, int] = {}
    for label, mod in (("hipflat", hipflat),):
        try:
            totals[label] = await _run_scraper(
                mod, supabase, label, MAX_LISTINGS_PER_SOURCE
            )
        except Exception as e:
            logger.error(f"[{label}] scraper crashed: {e}")
            totals[label] = 0
    logger.info(f"scraped totals: {totals}")

    logger.info("=== STAGE 2: regional averages (per district) ===")
    recompute_region_averages(supabase)

    logger.info("=== STAGE 3: bubble index ===")
    n_bi = compute_bubble_indices(supabase)
    logger.info(f"bubble_index: {n_bi} condos scored")

    logger.info("=== STAGE 4: livability (Overpass / OpenStreetMap) ===")
    await compute_livability(supabase)

    logger.info("=== STAGE 5: risk (district flood + news construction) ===")
    compute_risk(supabase)

    logger.info("=== STAGE 6: super value selection (top 5%) ===")
    compute_super_value(supabase, top_pct=5.0)

    logger.info("=== STAGE 7: developer reports ===")
    generate_reports(supabase)

    logger.info("=== STAGE 8: detect underpriced (≥20% below district avg) ===")
    n_alerts = detect_underpriced(supabase)
    logger.info(f"underpriced: {n_alerts} new alerts queued")

    logger.info("=== STAGE 9: dispatch alerts (Telegram) ===")
    dispatch_alerts(supabase)

    logger.info("pipeline complete")


if __name__ == "__main__":
    asyncio.run(main())
