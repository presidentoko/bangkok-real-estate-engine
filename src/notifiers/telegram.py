"""Telegram Bot API sender — no SDK, just HTTPS.

Setup:
  1. Talk to @BotFather on Telegram, /newbot, copy the token.
  2. Set TELEGRAM_BOT_TOKEN in .env.
  3. Subscribers must DM your bot once (so it has permission to send), then
     register their chat_id via the web subscribe form.
     They can find their chat_id by DMing @userinfobot.
"""
from __future__ import annotations

import os

import httpx
from loguru import logger

API_TEMPLATE = "https://api.telegram.org/bot{token}/sendMessage"

# MarkdownV2 reserved characters per Telegram docs.
_MD2_ESCAPE = r"_*[]()~`>#+-=|{}.!\\"


def telegram_token() -> str | None:
    return os.environ.get("TELEGRAM_BOT_TOKEN") or None


def escape_md(s: str | None) -> str:
    if not s:
        return ""
    out = []
    for ch in s:
        if ch in _MD2_ESCAPE:
            out.append("\\")
        out.append(ch)
    return "".join(out)


def send_telegram_message(
    chat_id: str,
    text: str,
    parse_mode: str = "MarkdownV2",
) -> bool:
    token = telegram_token()
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — skipping send")
        return False
    try:
        with httpx.Client(timeout=10) as http:
            r = http.post(
                API_TEMPLATE.format(token=token),
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": parse_mode,
                    "disable_web_page_preview": False,
                },
            )
        if r.status_code != 200:
            logger.warning(
                f"telegram send failed [{r.status_code}] for {chat_id}: "
                f"{r.text[:200]}"
            )
            return False
        return True
    except Exception as e:
        logger.warning(f"telegram send exception for {chat_id}: {e}")
        return False
