"""Yield-spread digest: gross yield minus current consumer mortgage rate.

A condo's gross yield only matters relative to the cost of borrowed money.
If MRR (Minimum Retail Rate — the rate most Thai mortgage products quote
against) is 7.10%, a 6% gross yield is a **negative real spread** — the
property is paid back slower than the mortgage is paid out. A 9% gross
yield gives ~+190bps cushion before vacancy / maintenance / tax eat in.

This digest pairs `condos.gross_yield_pct` with the latest BOT MRR pulled
into `macro_indicators` and surfaces the top positive-spread condos to
the ops Telegram chat.

Requires `macro_indicators` populated (run scripts/ingest_bot.py) AND
`condos.gross_yield_pct` populated (run scripts/compute_yields.py).
"""
from __future__ import annotations

import os
from datetime import date
from typing import Any

from loguru import logger
from supabase import Client

from src.notifiers.telegram import escape_md, send_telegram_message, telegram_token

# Indicators we'll average together as the "consumer mortgage rate" benchmark.
# MRR is what retail home-loan products quote against; min/max bracket the
# range Thai commercial banks publish in any given month.
MORTGAGE_RATE_INDICATORS = (
    "MRR (Minimum Retail Rate) Min",
    "MRR (Minimum Retail Rate) Max",
)


def get_current_mortgage_rate(supabase: Client) -> tuple[float, str] | None:
    """Return (mean MRR, period_iso) — None if BOT data isn't loaded yet."""
    rows = (
        supabase.table("macro_indicators")
        .select("indicator_name, value, period")
        .eq("source", "bot")
        .eq("series_code", "FM_RT_001_S2")
        .in_("indicator_name", list(MORTGAGE_RATE_INDICATORS))
        .order("period", desc=True)
        .limit(20)
        .execute()
        .data
    ) or []
    if not rows:
        return None
    latest = rows[0]["period"]
    same_period = [float(r["value"]) for r in rows if r["period"] == latest]
    if not same_period:
        return None
    return sum(same_period) / len(same_period), latest


def _format_thb(v: float | None) -> str:
    if v is None:
        return "—"
    v = float(v)
    if v >= 1_000_000:
        return f"฿{v / 1_000_000:.2f}M"
    return f"฿{v:,.0f}"


def build_digest(
    supabase: Client,
    *,
    top_n: int = 10,
    min_spread_pp: float = 1.0,
    max_yield: float = 25.0,
    min_sale_price: float = 500_000.0,
    min_samples: int = 2,
) -> str | None:
    """Build a MarkdownV2 digest of the top yield-spread condos.

    `min_spread_pp` is in percentage points (so 1.0 means yield > MRR + 1).
    """
    rate = get_current_mortgage_rate(supabase)
    if not rate:
        logger.info("yield_spread: no MRR data — run scripts/ingest_bot.py first")
        return None
    mortgage_rate, rate_period = rate
    threshold_yield = mortgage_rate + min_spread_pp

    rows = (
        supabase.table("condos")
        .select(
            "id, name, url, province, "
            "gross_yield_pct, avg_sale_price, avg_monthly_rent, "
            "yield_sample_sale, yield_sample_rent, "
            "regions(name)"
        )
        .gte("gross_yield_pct", threshold_yield)
        .lte("gross_yield_pct", max_yield)
        .gte("avg_sale_price", min_sale_price)
        .gte("yield_sample_sale", min_samples)
        .gte("yield_sample_rent", min_samples)
        .order("gross_yield_pct", desc=True)
        .limit(top_n)
        .execute()
        .data
    ) or []

    if not rows:
        return None

    rate_md = escape_md(f"{mortgage_rate:.2f}%")
    period_md = escape_md(rate_period[:7])  # YYYY-MM
    threshold_md = escape_md(f"+{min_spread_pp:.1f}pp")

    lines = [
        f"💰 *Top {len(rows)} yield\\-spread condos* "
        f"\\(spread ≥ {threshold_md} over MRR\\)\n"
        f"_MRR benchmark: {rate_md} \\(BOT, {period_md}\\)_\n"
    ]
    for i, r in enumerate(rows, 1):
        region = r.get("regions")
        if isinstance(region, list):
            region = region[0] if region else None
        loc = (region or {}).get("name") if region else None
        loc = loc or (r.get("province") or "").title() or "—"

        yld = float(r["gross_yield_pct"])
        spread = yld - mortgage_rate

        name_md = escape_md(r.get("name") or "Unknown")
        loc_md = escape_md(loc)
        yld_md = escape_md(f"{yld:.2f}%")
        spread_md = escape_md(f"+{spread:.2f}pp")
        sale_md = escape_md(_format_thb(r.get("avg_sale_price")))
        rent_md = escape_md(_format_thb(r.get("avg_monthly_rent")))

        url = r.get("url") or ""
        head = f"[{name_md}]({url})" if url else f"*{name_md}*"
        lines.append(
            f"{i}\\. {head} \\({loc_md}\\)\n"
            f"   `yield {yld_md}` · spread `{spread_md}` · "
            f"sale {sale_md} · rent {rent_md}/mo"
        )

    return "\n".join(lines)


def send_spread_digest(
    supabase: Client,
    *,
    top_n: int = 10,
    min_spread_pp: float = 1.0,
) -> int:
    if not telegram_token():
        logger.info("yield_spread: TELEGRAM_BOT_TOKEN not set — skipping")
        return 0
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not chat_id:
        logger.info("yield_spread: TELEGRAM_CHAT_ID not set — skipping")
        return 0

    msg = build_digest(supabase, top_n=top_n, min_spread_pp=min_spread_pp)
    if not msg:
        logger.info(
            "yield_spread: no condos cross the spread threshold "
            "(either BOT data missing or yields all below MRR)"
        )
        return 0

    if send_telegram_message(chat_id, msg):
        logger.info(f"yield_spread: sent digest to {chat_id}")
        return 1
    logger.warning("yield_spread: send failed")
    return 0
