"""Turn REIC narrative summaries into structured numeric fields via Claude.

REIC research reports embed the headline numbers in Thai narrative prose:
"ดัชนีราคา 101.9 จุด ปรับลง -1.0% YoY ... อุปทานใหม่ 12,453 หน่วย".
We let claude-haiku-4-5 read each summary and extract a tight JSON of
{price_index, yoy_change_pct, qoq_change_pct, supply_units, absorption_pct}.

Idempotent — only reports with llm_extracted_at IS NULL are processed.

Cost: ~$0.005 / report at haiku-4-5 pricing. ~$0.25 for the current
50-ish reports.

Usage:
  python scripts/extract_reic_numbers.py --limit 5 --dry-run   # smoke
  python scripts/extract_reic_numbers.py                        # full
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import anthropic  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

MODEL = "claude-haiku-4-5"

SYSTEM = """You extract structured real-estate KPIs from REIC (Thailand Real
Estate Information Center) research-report summaries. The text is in Thai or
mixed Thai-English. Return ONLY a single JSON object with exactly these keys:

{
  "price_index": <number or null>,
  "yoy_change_pct": <number or null>,
  "qoq_change_pct": <number or null>,
  "supply_units": <integer or null>,
  "absorption_pct": <number or null>
}

Rules:
- price_index: the report's headline index value (e.g., 101.9). Null if the
  report isn't a price-index style report.
- yoy_change_pct / qoq_change_pct: signed % change. Use negative for declines.
- supply_units: new-supply unit count for the period covered (if reported).
- absorption_pct: % of available units sold/absorbed in the period.
- If a field isn't explicitly stated in the summary, return null. Never guess.
- Output JSON ONLY — no markdown fence, no commentary."""

_JSON_RE = re.compile(r"\{[\s\S]*\}")


def parse_response(text: str) -> dict | None:
    m = _JSON_RE.search(text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _candidates(client, limit: int | None) -> list[dict]:
    q = (
        client.table("reic_reports")
        .select("id, reic_id, title, summary, region, category")
        .is_("llm_extracted_at", "null")
        .not_.is_("summary", "null")
        .order("reic_id", desc=True)
    )
    if limit:
        q = q.limit(limit)
    return q.execute().data or []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--delay-s", type=float, default=0.6,
                    help="Sleep between calls (Claude tolerates higher; politeness only)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Call the API but don't write — preview extractions")
    args = ap.parse_args()

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        logger.error("ANTHROPIC_API_KEY not set in env")
        return 2

    client = get_client()
    rows = _candidates(client, args.limit)
    logger.info(f"REIC LLM extract: {len(rows)} reports pending")
    if not rows:
        return 0

    anth = anthropic.Anthropic(api_key=key)
    written = 0
    failed = 0
    started = time.time()

    for i, r in enumerate(rows, 1):
        user_msg = (
            f"TITLE: {r['title']}\n"
            f"REGION: {r.get('region') or 'unknown'}\n"
            f"CATEGORY: {r.get('category') or 'unknown'}\n\n"
            f"SUMMARY:\n{r['summary'][:3500]}"
        )
        try:
            resp = anth.messages.create(
                model=MODEL,
                max_tokens=300,
                system=SYSTEM,
                messages=[{"role": "user", "content": user_msg}],
            )
        except Exception as e:
            logger.warning(f"  [{i}] reic_id={r['reic_id']} API error: {e}")
            failed += 1
            time.sleep(args.delay_s)
            continue

        text = "".join(
            getattr(block, "text", "") for block in resp.content
        )
        extracted = parse_response(text)
        if not extracted:
            logger.warning(
                f"  [{i}] reic_id={r['reic_id']} unparseable response: {text[:150]!r}"
            )
            failed += 1
            time.sleep(args.delay_s)
            continue

        logger.info(
            f"  [{i}/{len(rows)}] reic_id={r['reic_id']} "
            f"price={extracted.get('price_index')} "
            f"yoy={extracted.get('yoy_change_pct')} "
            f"qoq={extracted.get('qoq_change_pct')} "
            f"supply={extracted.get('supply_units')} "
            f"abs={extracted.get('absorption_pct')}"
        )

        if args.dry_run:
            time.sleep(args.delay_s)
            continue

        payload = {
            "price_index": extracted.get("price_index"),
            "yoy_change_pct": extracted.get("yoy_change_pct"),
            "qoq_change_pct": extracted.get("qoq_change_pct"),
            "supply_units": extracted.get("supply_units"),
            "absorption_pct": extracted.get("absorption_pct"),
            "llm_extracted_at": datetime.now(timezone.utc).isoformat(),
        }
        payload = {k: v for k, v in payload.items() if v is not None or k == "llm_extracted_at"}
        try:
            client.table("reic_reports").update(payload).eq("id", r["id"]).execute()
            written += 1
        except Exception as e:
            logger.warning(f"  DB write failed for reic_id={r['reic_id']}: {e}")
            failed += 1

        time.sleep(args.delay_s)

    elapsed = (time.time() - started) / 60
    logger.info(
        f"Done in {elapsed:.1f} min. "
        f"{'(dry-run)' if args.dry_run else f'written={written}'} failed={failed}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
