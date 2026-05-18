"""Auto-generate one weekly RealData blog post grounded in live DB facts.

Pipeline:
  1. Pull a small set of candidate "stories" from the DB (high-spread
     yield picks, foreign-quota standouts, rotating city spotlight).
  2. Pick this week's story by ISO-week modulo so we cycle through
     topics without external state.
  3. Hand the structured facts to Claude Sonnet 4.6 and ask for a strict
     JSON post matching the WeeklyPost schema in web/lib/weeklyPost.ts.
  4. Re-query the DB for every fact_bullet the model returned; if any
     number drifted more than the tolerance, refuse to publish.
  5. On verify-pass: write web/content/weekly/{slug}.json, then commit
     and push so Vercel builds the new page.

Designed to run on the self-hosted Windows runner as the last step of
weekly-refresh.yml. Skips silently (exit 0) if no candidate story has
enough rows — better to ship nothing than ship a thin post.

Usage:
  python scripts/generate_weekly_post.py                # publish if verify passes
  python scripts/generate_weekly_post.py --dry-run      # build + verify, no write
  python scripts/generate_weekly_post.py --topic spread # force a topic
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from anthropic import Anthropic  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

OUT_DIR = ROOT / "web" / "content" / "weekly"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2400

# Rotation of story topics — picked by ISO week number mod len. Adding
# a topic here is the one-line way to extend the auto-blog without
# touching prompt logic.
TOPICS = ["spread", "foreign-quota", "city-spotlight"]

# Topic 3 cycles through these cities (one per occurrence). Kept tight —
# we don't have meaningful coverage in Krabi/Chiang Rai/Samui yet.
CITY_ROTATION = ["bangkok", "phuket", "chiang-mai", "pattaya", "hua-hin", "chon-buri"]

CITY_DISPLAY = {
    "bangkok": "Bangkok",
    "phuket": "Phuket",
    "chiang-mai": "Chiang Mai",
    "pattaya": "Pattaya",
    "hua-hin": "Hua Hin",
    "chon-buri": "Chon Buri",
}


# ─────────────────────────────────────────────────────────────────────
# Candidate story pulls — each returns a (facts_dict | None). None
# means "not enough data for a meaningful post this week."
# ─────────────────────────────────────────────────────────────────────


def _current_mrr(client) -> float | None:
    """Average of MRR-min + MRR-max for the latest BOT period we have."""
    rows = (
        client.table("macro_indicators")
        .select("indicator_name, value, period")
        .eq("source", "bot")
        .eq("series_code", "FM_RT_001_S2")
        .in_("indicator_name", ["MRR (Minimum Retail Rate) Min", "MRR (Minimum Retail Rate) Max"])
        .order("period", desc=True)
        .limit(20)
        .execute()
        .data
    )
    if not rows:
        return None
    latest_period = rows[0]["period"]
    same = [r["value"] for r in rows if r["period"] == latest_period]
    return sum(same) / len(same) if same else None


def _paged_yields(client, *, province: str | None, min_yield: float, max_yield: float = 25.0) -> list[dict]:
    """Pull every active condo with yield in range. PostgREST caps single
    responses at 1000 rows so we paginate explicitly."""
    out: list[dict] = []
    offset = 0
    while True:
        q = (
            client.table("condos")
            .select(
                "id, name, province, gross_yield_pct, avg_sale_price, "
                "avg_monthly_rent, foreign_quota_inventory_pct, regions(name)",
            )
            .eq("is_active", True)
            .gte("gross_yield_pct", min_yield)
            .lte("gross_yield_pct", max_yield)
            .gte("avg_sale_price", 500_000)
            .gte("yield_sample_sale", 2)
            .gte("yield_sample_rent", 2)
            .range(offset, offset + 999)
        )
        if province:
            q = q.eq("province", province)
        rows = q.execute().data or []
        out.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return out


def candidate_spread(client) -> dict | None:
    """Top 5 condos by (gross_yield - MRR). Needs MRR to be known."""
    mrr = _current_mrr(client)
    if mrr is None:
        return None
    rows = _paged_yields(client, province=None, min_yield=mrr + 2.0)
    if len(rows) < 3:
        return None
    rows.sort(key=lambda r: -(r["gross_yield_pct"] or 0))
    top = rows[:5]
    return {
        "topic": "spread",
        "headline_hint": f"{len(top)} Thai condos where the rental yield beats the current mortgage rate by 2+ percentage points",
        "mrr_pct": round(mrr, 2),
        "condos": [
            {
                "condo_id": r["id"],
                "name": r["name"],
                "province": r["province"],
                "region": (r.get("regions") or {}).get("name") if isinstance(r.get("regions"), dict) else None,
                "gross_yield_pct": round(r["gross_yield_pct"], 2),
                "spread_pp": round(r["gross_yield_pct"] - mrr, 2),
                "avg_sale_price": r["avg_sale_price"],
                "avg_monthly_rent": r["avg_monthly_rent"],
            }
            for r in top
        ],
    }


def candidate_foreign_quota(client) -> dict | None:
    """Top 5 FazWaz buildings with highest foreign-quota inventory share."""
    out: list[dict] = []
    offset = 0
    while True:
        rows = (
            client.table("condos")
            .select(
                "id, name, province, foreign_quota_inventory_pct, "
                "foreign_quota_listings_available, total_quota_listings_observed, "
                "gross_yield_pct, avg_sale_price, regions(name)",
            )
            .eq("is_active", True)
            .eq("source", "fazwaz")
            .gte("foreign_quota_inventory_pct", 50)
            .gte("total_quota_listings_observed", 5)
            .range(offset, offset + 999)
            .execute()
            .data
            or []
        )
        out.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    if len(out) < 3:
        return None
    out.sort(
        key=lambda r: (
            -(r["foreign_quota_inventory_pct"] or 0),
            -(r["foreign_quota_listings_available"] or 0),
        )
    )
    top = out[:5]
    return {
        "topic": "foreign-quota",
        "headline_hint": "Thai condos with the most foreign-eligible inventory still on sale this week",
        "condos": [
            {
                "condo_id": r["id"],
                "name": r["name"],
                "province": r["province"],
                "region": (r.get("regions") or {}).get("name") if isinstance(r.get("regions"), dict) else None,
                "foreign_quota_inventory_pct": round(r["foreign_quota_inventory_pct"], 1),
                "foreign_quota_listings_available": r["foreign_quota_listings_available"],
                "total_quota_listings_observed": r["total_quota_listings_observed"],
                "gross_yield_pct": round(r["gross_yield_pct"], 2) if r.get("gross_yield_pct") else None,
                "avg_sale_price": r["avg_sale_price"],
            }
            for r in top
        ],
    }


def candidate_city_spotlight(client, city: str) -> dict | None:
    """Top 5 yield condos for the spotlight city this week."""
    rows = _paged_yields(client, province=city, min_yield=4.0)
    if len(rows) < 3:
        return None
    rows.sort(key=lambda r: -(r["gross_yield_pct"] or 0))
    top = rows[:5]
    mrr = _current_mrr(client)
    return {
        "topic": "city-spotlight",
        "city": city,
        "city_display": CITY_DISPLAY.get(city, city.title()),
        "mrr_pct": round(mrr, 2) if mrr else None,
        "headline_hint": f"{CITY_DISPLAY.get(city, city.title())} condos leading the yield ranking this week",
        "condos": [
            {
                "condo_id": r["id"],
                "name": r["name"],
                "province": r["province"],
                "region": (r.get("regions") or {}).get("name") if isinstance(r.get("regions"), dict) else None,
                "gross_yield_pct": round(r["gross_yield_pct"], 2),
                "avg_sale_price": r["avg_sale_price"],
                "avg_monthly_rent": r["avg_monthly_rent"],
                "foreign_quota_inventory_pct": round(r["foreign_quota_inventory_pct"], 1) if r.get("foreign_quota_inventory_pct") else None,
            }
            for r in top
        ],
    }


# ─────────────────────────────────────────────────────────────────────
# Topic picker
# ─────────────────────────────────────────────────────────────────────


def pick_topic(forced: str | None) -> str:
    if forced and forced in TOPICS:
        return forced
    week = date.today().isocalendar()[1]
    return TOPICS[week % len(TOPICS)]


def gather_facts(client, topic: str) -> dict | None:
    if topic == "spread":
        return candidate_spread(client)
    if topic == "foreign-quota":
        return candidate_foreign_quota(client)
    if topic == "city-spotlight":
        week = date.today().isocalendar()[1]
        city = CITY_ROTATION[week % len(CITY_ROTATION)]
        return candidate_city_spotlight(client, city)
    return None


# ─────────────────────────────────────────────────────────────────────
# Claude call
# ─────────────────────────────────────────────────────────────────────


SYSTEM_PROMPT = """You are RealData's weekly post writer. RealData is an independent Thai-condo data engine — we measure 8,994 buildings across 9 cities from listing prices, foreign-quota inventory, Bank of Thailand mortgage rates, BMA flood data, and OSM transit/infra layers. We accept no payment from developers; revenue is a flat broker referral if a reader closes a deal through us.

You write ONE weekly post per call. Constraints:

- Tone: confident, numbers-first, sharp. The reader is a serious foreign or local buyer skimming for an edge, not a casual browser. No sales fluff, no exclamation marks, no "discover the best!" copy.
- Length: lead = 2–3 sentences. 2 sections of 1–2 short paragraphs each. Tight.
- Numbers: every numeric claim in the post must come from the FACTS object you are given. Never invent a building name, yield, price, or rate. If you need an aggregate, derive it from the listed condos only.
- fact_bullets: 3–6 bullets. Each MUST set condo_id (use the UUID from FACTS) and expected (the rounded number you claimed). metric MUST be one of: gross_yield_pct, avg_sale_price, avg_monthly_rent, foreign_quota_inventory_pct, foreign_quota_listings_available, total_quota_listings_observed, spread_pp (derived: gross_yield - current MRR). Nothing else — the verifier will refuse to publish on unknown metrics or >2% drift.
- Markdown: plain. Bold via **text**, links via [text](/condo/UUID). No headings inside body — those come from the `heading` field on each section.
- Output: a single JSON object matching the WeeklyPost schema. NO prose before or after. NO code fences.

Schema:
{
  "slug": "kebab-case, prefixed with topic + ISO date, e.g. yield-spread-2026-05-18",
  "title": "<= 65 chars, headline-style, no 'this week' clichés",
  "description": "<= 160 chars, what the post measures + why it matters",
  "published_at": "YYYY-MM-DD (use the one passed in FACTS.today)",
  "topic": "<topic from FACTS.topic>",
  "lead": "2-3 sentence opener, plain markdown",
  "sections": [
    { "heading": "<= 60 chars", "body": "1-2 short paragraphs, plain markdown, paragraphs separated by blank line" }
  ],
  "fact_bullets": [
    { "label": "<building or thing>", "value": "<displayed value>", "condo_id": "<uuid or null>", "metric": "<DB column>", "expected": <number> }
  ]
}
"""


def call_model(facts: dict) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    client = Anthropic(api_key=api_key)
    user_payload = {"FACTS": facts, "today": date.today().isoformat()}
    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False, indent=2),
            }
        ],
    )
    text_blocks = [b.text for b in resp.content if hasattr(b, "text")]
    text = "".join(text_blocks).strip()
    # Be lenient: strip any accidental code fences.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error("[weekly] model returned non-JSON: {}", text[:400])
        raise RuntimeError(f"model JSON parse failed: {e}") from e


# ─────────────────────────────────────────────────────────────────────
# Self-verification
# ─────────────────────────────────────────────────────────────────────

TOLERANCE_PCT = 0.02  # 2% drift allowed (rounding + cron lag)


def _fetch_metric(client, condo_id: str, metric: str) -> Any:
    # NOTE: supabase-py's .maybe_single() raises APIError on a 204 No
    # Content response (instead of returning None), which happens when
    # the id doesn't match. Use .limit(1) and handle the empty list
    # ourselves so verification can flag "row missing" cleanly.
    try:
        rows = (
            client.table("condos")
            .select(metric)
            .eq("id", condo_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception as e:
        logger.warning("[weekly] fetch_metric failed for {} {}: {}", condo_id, metric, e)
        return None
    if not rows:
        return None
    return rows[0].get(metric)


# Whitelisted metrics — anything else is rejected as a model hallucination.
# spread_pp is derived (yield - MRR) so the verifier looks it up live.
DIRECT_METRICS = {
    "gross_yield_pct",
    "avg_sale_price",
    "avg_monthly_rent",
    "foreign_quota_inventory_pct",
    "foreign_quota_listings_available",
    "total_quota_listings_observed",
}
DERIVED_METRICS = {"spread_pp"}


def _resolve_metric(client, condo_id: str, metric: str, mrr: float | None) -> Any:
    if metric in DIRECT_METRICS:
        return _fetch_metric(client, condo_id, metric)
    if metric == "spread_pp":
        if mrr is None:
            return None
        yield_val = _fetch_metric(client, condo_id, "gross_yield_pct")
        if yield_val is None:
            return None
        return float(yield_val) - mrr
    return None  # unknown metric


def verify_post(client, post: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []
    # MRR cached once per verify run — spread_pp resolutions need it.
    mrr = _current_mrr(client)
    for i, bullet in enumerate(post.get("fact_bullets", [])):
        condo_id = bullet.get("condo_id")
        metric = bullet.get("metric")
        expected = bullet.get("expected")
        if not (condo_id and metric and expected is not None):
            continue  # bullets without verifiable claims are allowed
        if metric not in DIRECT_METRICS and metric not in DERIVED_METRICS:
            errors.append(f"bullet#{i}: metric {metric!r} not in whitelist")
            continue
        actual = _resolve_metric(client, condo_id, metric, mrr)
        if actual is None:
            errors.append(f"bullet#{i}: condo {condo_id} or metric {metric} not found")
            continue
        try:
            actual_f = float(actual)
            expected_f = float(expected)
        except (TypeError, ValueError):
            errors.append(f"bullet#{i}: non-numeric actual={actual!r} expected={expected!r}")
            continue
        if expected_f == 0:
            if abs(actual_f) > 0.01:
                errors.append(f"bullet#{i}: expected 0 but DB has {actual_f}")
            continue
        drift = abs(actual_f - expected_f) / abs(expected_f)
        if drift > TOLERANCE_PCT:
            errors.append(
                f"bullet#{i}: {metric} for {condo_id} drifted "
                f"{drift*100:.1f}% (expected {expected_f}, actual {actual_f})"
            )
    return (len(errors) == 0, errors)


# ─────────────────────────────────────────────────────────────────────
# Publish: write JSON + git commit + push + Telegram alert
# ─────────────────────────────────────────────────────────────────────


def slug_already_published(slug: str) -> bool:
    return (OUT_DIR / f"{slug}.json").exists()


def write_post(post: dict) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fp = OUT_DIR / f"{post['slug']}.json"
    fp.write_text(json.dumps(post, ensure_ascii=False, indent=2), encoding="utf-8")
    return fp


def git_commit_and_push(fp: Path, title: str) -> bool:
    """Returns True on push success."""
    cwd = ROOT
    user = "RealData Auto-Blog"
    email = "auto-blog@passionaryestate.com"
    rel = fp.relative_to(cwd).as_posix()
    msg = f"post(weekly): {title}\n\nAuto-generated by scripts/generate_weekly_post.py"
    try:
        subprocess.run(
            ["git", "-c", f"user.name={user}", "-c", f"user.email={email}", "add", rel],
            cwd=cwd, check=True,
        )
        subprocess.run(
            ["git", "-c", f"user.name={user}", "-c", f"user.email={email}", "commit", "-m", msg],
            cwd=cwd, check=True,
        )
        subprocess.run(["git", "push", "origin", "HEAD"], cwd=cwd, check=True)
        return True
    except subprocess.CalledProcessError as e:
        logger.error("[weekly] git step failed: {}", e)
        return False


def telegram_notify(text: str) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat):
        return
    import requests
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": text},
            timeout=10,
        )
    except Exception:
        pass


def _gh_run_url() -> str:
    """If running inside GH Actions, returns the canonical URL of this run.
    Empty string when run locally."""
    repo = os.environ.get("GITHUB_REPOSITORY")
    rid = os.environ.get("GITHUB_RUN_ID")
    if repo and rid:
        return f"https://github.com/{repo}/actions/runs/{rid}"
    return ""


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", choices=TOPICS, default=None)
    ap.add_argument("--dry-run", action="store_true", help="generate + verify, skip write/push")
    args = ap.parse_args()

    client = get_client()
    topic = pick_topic(args.topic)
    logger.info("[weekly] picked topic: {}", topic)

    facts = gather_facts(client, topic)
    if facts is None:
        logger.info("[weekly] no candidate story for topic={}, exiting clean", topic)
        return 0
    facts["topic"] = topic
    facts["today"] = date.today().isoformat()

    logger.info("[weekly] calling model...")
    try:
        post = call_model(facts)
    except Exception as e:
        # Log the full exception locally / to GH Actions logs (visible to ops only)
        logger.exception("[weekly] model call failed")
        # Telegram message stays high-level: type of error + topic + run link.
        # Exception text intentionally omitted — could leak headers/keys.
        msg_lines = [
            f"⚠️ Weekly post FAILED — model call error",
            f"Topic: {topic}",
            f"Error type: {type(e).__name__}",
        ]
        run_url = _gh_run_url()
        if run_url:
            msg_lines.append(f"Logs: {run_url}")
        telegram_notify("\n".join(msg_lines))
        return 1

    # Slug collision guard — never overwrite an existing post.
    if slug_already_published(post.get("slug", "")):
        logger.info("[weekly] slug {} already published, exiting clean", post.get("slug"))
        return 0

    ok, errors = verify_post(client, post)
    if not ok:
        logger.warning("[weekly] verify failed, refusing to publish:")
        for e in errors:
            logger.warning("  - {}", e)
        # Telegram summary: topic + how many bullets failed + run link.
        # The detailed UUIDs / column names stay in GH Actions logs only.
        total = len(post.get("fact_bullets", []))
        msg_lines = [
            f"⏭️  Weekly post SKIPPED — fact verification failed",
            f"Topic: {topic} ({post.get('title', '?')})",
            f"{len(errors)} of {total} fact bullets didn't match the DB.",
            "The model's numbers drifted from the live data — refused to publish.",
        ]
        run_url = _gh_run_url()
        if run_url:
            msg_lines.append(f"Logs: {run_url}")
        telegram_notify("\n".join(msg_lines))
        return 0  # exit clean — silence over noise

    if args.dry_run:
        logger.info("[weekly] dry-run OK. Post payload:\n{}", json.dumps(post, ensure_ascii=False, indent=2)[:2000])
        return 0

    fp = write_post(post)
    logger.info("[weekly] wrote {}", fp)

    if not git_commit_and_push(fp, post["title"]):
        msg_lines = [
            "⚠️ Weekly post FAILED — git push error",
            f"Topic: {topic}",
            f"Slug: {post['slug']} (JSON written but not pushed)",
        ]
        run_url = _gh_run_url()
        if run_url:
            msg_lines.append(f"Logs: {run_url}")
        telegram_notify("\n".join(msg_lines))
        return 1

    site = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://passionaryestate.com")
    url = f"{site}/en/blog/weekly/{post['slug']}"
    n_bullets = len(post.get("fact_bullets", []))
    msg_lines = [
        f"✅ Weekly post published",
        f"{post['title']}",
        f"Topic: {topic} · {n_bullets} verified facts",
        url,
    ]
    telegram_notify("\n".join(msg_lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
