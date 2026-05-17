"""Top-yield digest: rank condos by gross rental yield, push to ops Telegram chat.

Sends a single, formatted MarkdownV2 message to TELEGRAM_CHAT_ID listing the
top-N condos by gross_yield_pct (computed in scripts/compute_yields.py). This
is an ops digest, not a subscriber fan-out — same channel as the weekly
success/fail notifications.

Skipped silently if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID aren't set.
"""
from __future__ import annotations

import os

from loguru import logger
from supabase import Client

from src.notifiers.telegram import escape_md, send_telegram_message, telegram_token


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
    min_yield: float = 6.0,
    max_yield: float = 25.0,
    min_sale_price: float = 500_000.0,
    min_samples: int = 2,
) -> str | None:
    """Return MarkdownV2 message string, or None if no qualifying condos.

    max_yield + min_sale_price filter out data-quality outliers (per-sqm
    figures mis-stored as full sale price, etc.) which otherwise dominate
    the top of the rank list with implausible 100%+ yields.
    """
    rows = (
        supabase.table("condos")
        .select(
            "id, name, url, province, "
            "gross_yield_pct, avg_sale_price, avg_monthly_rent, "
            "yield_sample_sale, yield_sample_rent, "
            "regions(name)"
        )
        .gte("gross_yield_pct", min_yield)
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

    lines = [
        f"📈 *Top {len(rows)} yields this week* "
        f"\\(≥{escape_md(f'{min_yield:.1f}%')}, "
        f"≥{min_samples} sale & rent samples\\)\n",
    ]
    for i, r in enumerate(rows, 1):
        region = r.get("regions")
        if isinstance(region, list):
            region = region[0] if region else None
        region_name = (region or {}).get("name") if region else None
        province = (r.get("province") or "").title() or "—"
        loc = region_name or province

        name_md = escape_md(r.get("name") or "Unknown")
        loc_md = escape_md(loc)
        yld = float(r["gross_yield_pct"])
        yld_md = escape_md(f"{yld:.2f}%")
        sale_md = escape_md(_format_thb(r.get("avg_sale_price")))
        rent_md = escape_md(_format_thb(r.get("avg_monthly_rent")))
        ns = r.get("yield_sample_sale") or 0
        nr = r.get("yield_sample_rent") or 0
        sample_md = escape_md(f"n={ns}/{nr}")

        url = r.get("url") or ""
        head = f"[{name_md}]({url})" if url else f"*{name_md}*"
        lines.append(
            f"{i}\\. {head} \\({loc_md}\\)\n"
            f"   `{yld_md}` · sale {sale_md} · rent {rent_md}/mo · {sample_md}"
        )

    return "\n".join(lines)


def send_yield_digest(
    supabase: Client,
    *,
    top_n: int = 10,
    min_yield: float = 6.0,
    min_samples: int = 2,
) -> int:
    """Build + send digest to TELEGRAM_CHAT_ID. Returns 1 on send, 0 on skip."""
    if not telegram_token():
        logger.info("yield_digest: TELEGRAM_BOT_TOKEN not set — skipping")
        return 0
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not chat_id:
        logger.info("yield_digest: TELEGRAM_CHAT_ID not set — skipping")
        return 0

    msg = build_digest(
        supabase, top_n=top_n, min_yield=min_yield, min_samples=min_samples
    )
    if not msg:
        logger.info(
            f"yield_digest: no condos with yield ≥ {min_yield}% "
            f"and ≥{min_samples} samples — nothing to send"
        )
        return 0

    ok = send_telegram_message(chat_id, msg)
    if ok:
        logger.info(f"yield_digest: sent top-yield digest to {chat_id}")
        return 1
    logger.warning("yield_digest: send failed")
    return 0
