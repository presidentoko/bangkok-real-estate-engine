"""Analysis pipeline: risk → super_value → underpriced alerts → developer reports.

Runs after compute_value_scores.py has written fresh bubble_index values.

Steps
-----
1. compute_risk      — flood (static district lookup) + construction (Google News RSS)
                       → writes risk_factors per condo
2. compute_super_value — top 5% by asset value AND livability (after risk penalty)
                         → writes is_super_value + rank columns to value_scores
3. detect_underpriced  — bubble_index ≤ 80 → enqueues underpriced_alerts rows
4. dispatch_alerts     — sends queued alerts to Telegram subscribers (skips if no token)
5. generate_reports    — per-condo strength/weakness → developer_reports table

Usage:
  python scripts/run_analysis.py
  python scripts/run_analysis.py --skip-risk   # skip Google News RSS calls
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger  # noqa: E402

from src.analysis.risk import compute_risk  # noqa: E402
from src.analysis.super_value import compute_super_value  # noqa: E402
from src.analysis.underpriced import detect_underpriced  # noqa: E402
from src.db import get_client  # noqa: E402
from src.notifiers.dispatcher import dispatch_alerts  # noqa: E402
from src.reports.generator import generate_reports  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--skip-risk",
        action="store_true",
        help="Skip risk computation (avoids Google News RSS calls)",
    )
    args = ap.parse_args()

    logger.remove()
    logger.add(sys.stderr, level="INFO")

    client = get_client()

    if not args.skip_risk:
        logger.info("=== STEP 1: risk (flood + construction news) ===")
        n_risk = compute_risk(client)
        logger.info(f"risk: {n_risk} condos written")
    else:
        logger.info("=== STEP 1: risk — SKIPPED ===")

    logger.info("=== STEP 2: super_value (top 5% asset × livability) ===")
    n_super = compute_super_value(client, top_pct=5.0)
    logger.info(f"super_value: {n_super} condos flagged")

    logger.info("=== STEP 3: detect underpriced (bubble_index ≤ 80) ===")
    n_alerts = detect_underpriced(client)
    logger.info(f"underpriced: {n_alerts} new alerts queued")

    logger.info("=== STEP 4: dispatch alerts (Telegram) ===")
    n_sent = dispatch_alerts(client)
    logger.info(f"dispatch: {n_sent} messages sent")

    logger.info("=== STEP 5: developer reports ===")
    n_reports = generate_reports(client)
    logger.info(f"reports: {n_reports} generated")

    logger.info("analysis pipeline complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
