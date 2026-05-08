"""Fan-out: pull unsent alerts, push to active subscribers, mark sent."""
from __future__ import annotations

from datetime import datetime, timezone

from loguru import logger
from supabase import Client

from src.notifiers.telegram import escape_md, send_telegram_message, telegram_token


def _format_md(a: dict) -> str:
    name = escape_md(a.get("name") or "Unknown")
    region = escape_md(a.get("region_name") or "Bangkok")
    bi = float(a["bubble_index"])
    discount_pct = max(0.0, 100.0 - bi)
    bi_md = escape_md(f"{bi:.1f}")
    discount_md = escape_md(f"{discount_pct:.1f}%")

    price = a.get("price")
    pps = a.get("price_per_sqm")
    avg = a.get("region_avg_pps")
    price_md = escape_md(
        f"฿{float(price)/1_000_000:.2f}M" if price and float(price) >= 1_000_000
        else (f"฿{float(price):,.0f}" if price else "—")
    )
    pps_md = escape_md(f"฿{float(pps):,.0f}/m²") if pps else escape_md("—")
    avg_md = escape_md(f"฿{float(avg):,.0f}/m²") if avg else escape_md("—")

    url = a.get("url") or ""
    link_md = f"[View listing]({url})" if url else ""

    return (
        f"🚨 *Underpriced* in *{region}*\n"
        f"*{name}*\n"
        f"`Bubble Index {bi_md}`  \\(\\-{discount_md} vs district avg\\)\n"
        f"💰 {price_md}  ·  {pps_md}\n"
        f"📊 district avg {avg_md}\n"
        f"{link_md}"
    )


def dispatch_alerts(supabase: Client) -> int:
    if not telegram_token():
        logger.warning(
            "TELEGRAM_BOT_TOKEN not configured — alerts written, dispatch skipped"
        )
        return 0

    pending = (
        supabase.table("underpriced_alerts")
        .select(
            "id, condo_id, bubble_index, region_name, price, price_per_sqm, "
            "region_avg_pps, condos(name, url)"
        )
        .is_("sent_at", "null")
        .order("detected_at", desc=False)
        .limit(200)
        .execute().data
    )
    if not pending:
        logger.info("dispatch: no pending alerts")
        return 0

    subs = (
        supabase.table("alert_subscribers")
        .select("*")
        .eq("channel", "telegram")
        .eq("is_active", True)
        .execute().data
    )
    if not subs:
        logger.info(
            f"dispatch: {len(pending)} alerts pending but no telegram subscribers"
        )
        return 0

    delivered_total = 0
    now = datetime.now(timezone.utc).isoformat()

    for alert in pending:
        condo = alert.get("condos")
        if isinstance(condo, list):
            condo = condo[0] if condo else None
        flat = {
            **alert,
            "name": (condo or {}).get("name"),
            "url": (condo or {}).get("url"),
        }
        text = _format_md(flat)

        sent_count = 0
        bi = float(alert["bubble_index"])
        for sub in subs:
            districts = sub.get("districts") or []
            if districts and flat.get("region_name") not in districts:
                continue
            if bi > float(sub.get("bubble_threshold") or 80):
                continue
            if send_telegram_message(sub["channel_id"], text):
                sent_count += 1

        supabase.table("underpriced_alerts").update({
            "sent_at": now,
            "sent_to_count": sent_count,
        }).eq("id", alert["id"]).execute()
        delivered_total += sent_count

    logger.info(
        f"dispatch: delivered {delivered_total} messages across {len(pending)} alerts"
    )
    return delivered_total
