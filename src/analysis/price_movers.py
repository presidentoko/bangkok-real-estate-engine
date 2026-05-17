"""Price movers digest: biggest weekly drops + jumps from price_history.

After snapshot_prices() runs each week, every (condo_id, listing_type) gets a
fresh row in price_history with delta_pct computed vs. the previous snapshot.

This module reads the latest snapshot per condo+type, ranks by signed delta,
and pushes the top drops/jumps to the ops Telegram chat.

First snapshot has no delta (no prior baseline) — so the digest stays empty
until the second weekly run.
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


def _fetch_latest_deltas(
    supabase: Client, *, lookback_days: int = 14
) -> list[dict]:
    """Return one row per (condo_id, listing_type), the most recent snapshot
    inside the lookback window that has a non-null delta_pct.

    We can't push the dedup into PostgREST cleanly, so we fetch the recent
    window (small — ~7-14k rows per week) and dedup in Python.
    """
    from datetime import datetime, timedelta, timezone
    since = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).isoformat()

    rows = (
        supabase.table("price_history")
        .select("condo_id, listing_type, price, price_per_sqm, delta_pct, captured_at")
        .gte("captured_at", since)
        .not_.is_("delta_pct", "null")
        .order("captured_at", desc=True)
        .limit(50000)
        .execute()
        .data
    ) or []

    latest: dict[tuple[str, str], dict] = {}
    for r in rows:
        key = (r["condo_id"], r["listing_type"])
        if key not in latest:
            latest[key] = r
    return list(latest.values())


def _hydrate_condos(supabase: Client, condo_ids: list[str]) -> dict[str, dict]:
    if not condo_ids:
        return {}
    out: dict[str, dict] = {}
    for i in range(0, len(condo_ids), 200):
        chunk = condo_ids[i:i + 200]
        rows = (
            supabase.table("condos")
            .select("id, name, url, province, regions(name)")
            .in_("id", chunk)
            .execute()
            .data
        ) or []
        for r in rows:
            out[r["id"]] = r
    return out


def _format_row(r: dict, condo: dict, sign: str) -> str:
    name = escape_md(condo.get("name") or "Unknown")
    region = condo.get("regions")
    if isinstance(region, list):
        region = region[0] if region else None
    loc = (region or {}).get("name") if region else None
    loc = loc or (condo.get("province") or "").title() or "—"

    delta = float(r["delta_pct"])
    arrow = "🔻" if delta < 0 else "🔺"
    delta_md = escape_md(f"{delta:+.1f}%")
    price_md = escape_md(_format_thb(r.get("price")))
    lt_md = escape_md(r["listing_type"])
    loc_md = escape_md(loc)

    url = condo.get("url") or ""
    head = f"[{name}]({url})" if url else f"*{name}*"
    return (
        f"{arrow} `{delta_md}` {head} \\({loc_md}\\) · "
        f"{lt_md} {price_md}"
    )


def build_digest(
    supabase: Client,
    *,
    top_n: int = 5,
    min_abs_delta: float = 3.0,
    listing_type: str | None = None,
) -> str | None:
    """Return MarkdownV2 message, or None if no movers cross the threshold."""
    rows = _fetch_latest_deltas(supabase)
    if listing_type:
        rows = [r for r in rows if r["listing_type"] == listing_type]
    rows = [r for r in rows if abs(float(r["delta_pct"])) >= min_abs_delta]
    if not rows:
        return None

    drops = sorted(rows, key=lambda r: float(r["delta_pct"]))[:top_n]
    jumps = sorted(rows, key=lambda r: float(r["delta_pct"]), reverse=True)[:top_n]

    condo_ids = list({r["condo_id"] for r in drops + jumps})
    condos = _hydrate_condos(supabase, condo_ids)

    threshold_md = escape_md(f"≥{min_abs_delta:.0f}%")
    lines = [
        f"📊 *Price movers this week* \\({threshold_md} change\\)\n",
    ]

    if drops:
        lines.append(f"*Top {len(drops)} drops* \\(potential deals\\)")
        for r in drops:
            c = condos.get(r["condo_id"])
            if c:
                lines.append(_format_row(r, c, "drop"))
        lines.append("")

    if jumps:
        lines.append(f"*Top {len(jumps)} jumps*")
        for r in jumps:
            c = condos.get(r["condo_id"])
            if c:
                lines.append(_format_row(r, c, "jump"))

    return "\n".join(lines).rstrip()


def send_price_movers_digest(
    supabase: Client,
    *,
    top_n: int = 5,
    min_abs_delta: float = 3.0,
) -> int:
    """Build + send digest to TELEGRAM_CHAT_ID. Returns 1 on send, 0 on skip."""
    if not telegram_token():
        logger.info("price_movers: TELEGRAM_BOT_TOKEN not set — skipping")
        return 0
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not chat_id:
        logger.info("price_movers: TELEGRAM_CHAT_ID not set — skipping")
        return 0

    msg = build_digest(supabase, top_n=top_n, min_abs_delta=min_abs_delta)
    if not msg:
        logger.info(
            f"price_movers: no condos with |Δ| ≥ {min_abs_delta:.1f}% "
            f"in latest snapshots — nothing to send "
            f"(expected on the first snapshot; deltas appear next run)"
        )
        return 0

    ok = send_telegram_message(chat_id, msg)
    if ok:
        logger.info(f"price_movers: sent digest to {chat_id}")
        return 1
    logger.warning("price_movers: send failed")
    return 0
