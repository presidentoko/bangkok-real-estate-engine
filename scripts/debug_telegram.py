"""Telegram bot diagnostics — answers two questions:
  1. Is the token valid? (calls getMe)
  2. Who has actually messaged this bot? (calls getUpdates)

Usage:
    python scripts/debug_telegram.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT, ".env")


def load_env() -> None:
    if not os.path.exists(ENV_PATH):
        sys.exit(f"❌ .env not found at {ENV_PATH}")
    with open(ENV_PATH, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


def call(token: str, method: str) -> dict:
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


def main() -> None:
    load_env()
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        sys.exit("❌ TELEGRAM_BOT_TOKEN missing in .env")

    print("=" * 60)
    print("STEP 1: Verify token (getMe)")
    print("=" * 60)
    me = call(token, "getMe")
    if not me.get("ok"):
        print(f"❌ Token invalid or revoked. Response: {me}")
        sys.exit(1)
    bot = me["result"]
    print(f"✅ Token works")
    print(f"   Bot username: @{bot.get('username')}")
    print(f"   Bot name:     {bot.get('first_name')}")
    print(f"   Bot id:       {bot.get('id')}")

    print()
    print("=" * 60)
    print("STEP 2: Who has messaged this bot? (getUpdates)")
    print("=" * 60)
    updates = call(token, "getUpdates")
    if not updates.get("ok"):
        print(f"❌ getUpdates failed: {updates}")
        sys.exit(1)
    results = updates.get("result", [])
    if not results:
        print("⚠️  No messages found.")
        print()
        print("   This means NOBODY has /start'd the bot yet, OR")
        print("   the messages are older than 24h (Telegram drops them).")
        print()
        print("   Fix: open Telegram → search for @" + bot.get("username", "") + " →")
        print("        press START → re-run this script.")
        sys.exit(0)

    print(f"✅ Found {len(results)} update(s). Chats that messaged the bot:")
    print()
    seen: dict[int, dict] = {}
    for u in results:
        msg = u.get("message") or u.get("edited_message") or {}
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid is None or cid in seen:
            continue
        seen[cid] = chat

    for cid, chat in seen.items():
        name = " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")]))
        username = chat.get("username")
        print(f"   chat_id = {cid}")
        print(f"   name    = {name or '(no name)'}")
        print(f"   @       = {username or '(no username)'}")
        print(f"   type    = {chat.get('type')}")
        print()
    print("👉 Use one of the chat_id values above:")
    print(f"   python scripts/test_telegram.py <chat_id>")


if __name__ == "__main__":
    main()
