"""Quick Telegram bot smoke test — no dependencies, reads token from .env.

Usage:
    python scripts/test_telegram.py <your_chat_id>
    python scripts/test_telegram.py <your_chat_id> "custom message"
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
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


def main() -> None:
    load_env()
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        sys.exit("❌ TELEGRAM_BOT_TOKEN is empty in .env")

    if len(sys.argv) < 2:
        sys.exit("Usage: python scripts/test_telegram.py <chat_id> [message]")

    chat_id = sys.argv[1].strip()
    text = sys.argv[2] if len(sys.argv) > 2 else "✅ hello from RealData bot"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            payload = json.loads(r.read().decode())
        if payload.get("ok"):
            print(f"✅ sent to chat_id={chat_id}")
        else:
            print(f"❌ telegram replied: {payload}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")
        print(f"❌ HTTP {e.code}: {body[:300]}")
    except Exception as e:
        print(f"❌ {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
