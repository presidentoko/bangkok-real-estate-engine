"""Verify .env values without exposing secrets.

Usage: python scripts/check_env.py
"""
from __future__ import annotations

import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT, ".env")


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.exists(ENV_PATH):
        sys.exit(f"❌ .env not found at {ENV_PATH}")
    with open(ENV_PATH, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
    return out


def peek_jwt_role(jwt: str) -> str | None:
    try:
        payload_b64 = jwt.split(".")[1]
        # add padding
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("role")
    except Exception:
        return None


def main() -> None:
    env = load_env()
    print(f"📂 .env at: {ENV_PATH}\n")

    checks = [
        ("SUPABASE_URL", "url", lambda v: v.startswith("https://") and v.endswith(".supabase.co")),
        ("SUPABASE_SERVICE_KEY", "jwt", lambda v: v.startswith("eyJ") and len(v) > 150),
        ("TELEGRAM_BOT_TOKEN", "token", lambda v: ":" in v and len(v) > 30),
    ]

    for key, kind, ok_fn in checks:
        v = env.get(key, "")
        if not v:
            print(f"❌ {key:25s} EMPTY")
            continue

        length = len(v)
        head = v[:6]
        tail = v[-4:]
        ok = ok_fn(v)

        line = f"{'✅' if ok else '⚠️ '} {key:25s} len={length:4d}  starts='{head}…'  ends='…{tail}'"
        print(line)

        if kind == "jwt":
            role = peek_jwt_role(v)
            if role == "service_role":
                print(f"   → role: service_role  ✅ (correct for server use)")
            elif role == "anon":
                print(f"   → role: anon  ❌ WRONG KEY — copy 'service_role' from Supabase, not 'anon'")
            elif role:
                print(f"   → role: {role}  ⚠️  unexpected")
            else:
                print(f"   → could not decode JWT — key may be truncated or malformed")

        if v.startswith('"') or v.endswith('"') or v.startswith("'") or v.endswith("'"):
            print(f"   ⚠️  has quotes — remove them, .env doesn't need quotes")
        if v != v.strip():
            print(f"   ⚠️  has trailing/leading whitespace")

    print()
    print("If everything is ✅, run: python -m src.main")


if __name__ == "__main__":
    main()
