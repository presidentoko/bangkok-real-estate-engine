"""Give each weekly post a Korean and a Thai body, and real condo links.

Why this exists
---------------
/ko/blog/weekly/<slug> and /th/blog/weekly/<slug> were the English post
inside localized chrome. Two costs:

  * A Korean reader arriving from Naver (the one channel this site can
    win on) met an English article and left.
  * Three URLs with one English body is exactly the shape that produced
    375 "Duplicate, Google chose different canonical" on the district
    pages, and it was being re-created every Sunday.

This script adds `i18n: {ko: {...}, th: {...}}` to the post JSON — title,
description, lead, section headings + bodies, fact-bullet labels + values
— and the page reads `post.i18n?.[lang] ?? post`. English stays the
source of truth and the verifier's target; the translations are checked
mechanically for not introducing a single number the English does not
contain, and are dropped (post still publishes in English) if they do.

It also fixes the links. The generator writes [name](/condo/<uuid>) and
fact bullets carry only condo_id; both resolve through a meta-refresh to
/condo/<slug>. Slugs are looked up from condos_published here and written
into the JSON — `slug` on each bullet, and the uuid replaced in every
body — so the page links straight to the canonical URL.

Runs inside generate_weekly_post.py before the commit (one push, one
build), and as a CLI for backfilling posts that predate it:

    python scripts/localize_weekly_post.py --all        # every post lacking i18n
    python scripts/localize_weekly_post.py --slug foreign-quota-2026-08-23
    python scripts/localize_weekly_post.py --all --force  # re-translate
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from anthropic import Anthropic  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

POSTS_DIR = ROOT / "web" / "content" / "weekly"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 6000
LANGS = ("ko", "th")

SYSTEM_PROMPT = """You translate a verified English real-estate data post into Korean and Thai for publication on the same site. You receive the post as JSON.

Translate these fields and nothing else: title, description, lead, every sections[i].heading and sections[i].body, every fact_bullets[i].label and fact_bullets[i].value.

HARD RULES
- Numbers, percentages, prices, dates, currency symbols and building names stay EXACTLY as in the English. Do not convert currency, do not round, do not add figures. Building names stay in Latin script as written (you may append a Korean/Thai transliteration in parentheses ONLY in the body text, never in titles or bullet labels).
- Markdown links [text](url): translate the text, keep the url byte-for-byte. Keep **bold** and `code` markers in place.
- Keep paragraph breaks (\\n\\n) where the English has them.
- Korean: 합니다/입니다 register, natural data-journalism tone, no 습니다체 stiffness. Use standard Korean terms: 임대수익률, 외국인 쿼터, 시세, 평당 → per sqm stays "㎡당". Titles 25–45 characters.
- Thai: formal written register, no particles like ค่ะ/ครับ. Titles under 70 characters.
- Never add a sentence that is not in the English. Never drop one.

Return ONLY a JSON object:
{
  "ko": {"title": ..., "description": ..., "lead": ..., "sections": [{"heading": ..., "body": ...}, ...], "fact_bullets": [{"label": ..., "value": ...}, ...]},
  "th": {same shape}
}
sections and fact_bullets must have the same length and order as the English.
"""

_NUM_RE = re.compile(r"\d+(?:[.,]\d+)*")
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def _nums(text: str) -> set[str]:
    return {n.replace(",", "") for n in _NUM_RE.findall(text)}


def _translatable_text(block: dict) -> str:
    parts = [block.get("title", ""), block.get("description", ""), block.get("lead", "")]
    for s in block.get("sections", []):
        parts += [s.get("heading", ""), s.get("body", "")]
    for b in block.get("fact_bullets", []):
        parts += [b.get("label", ""), b.get("value", "")]
    return "\n".join(parts)


def audit(post: dict, tr: dict) -> list[str]:
    """Reasons the translation must be rejected. Empty list == accept."""
    bad: list[str] = []
    allowed = _nums(_translatable_text(post))
    for lang in LANGS:
        blk = tr.get(lang)
        if not isinstance(blk, dict):
            bad.append(f"{lang}: missing")
            continue
        for k in ("title", "description", "lead"):
            if not isinstance(blk.get(k), str) or not blk[k].strip():
                bad.append(f"{lang}.{k}: empty")
        if len(blk.get("sections", [])) != len(post.get("sections", [])):
            bad.append(f"{lang}.sections: length {len(blk.get('sections', []))} != {len(post.get('sections', []))}")
        if len(blk.get("fact_bullets", [])) != len(post.get("fact_bullets", [])):
            bad.append(f"{lang}.fact_bullets: length mismatch")
        extra = _nums(_translatable_text(blk)) - allowed
        # Tolerate tiny ordinals the translation may introduce (첫 번째 → "1", ข้อ 2).
        extra = {n for n in extra if not (n.isdigit() and int(n) <= 12)}
        if extra:
            bad.append(f"{lang}: numbers not in English: {sorted(extra)[:8]}")
        # Every markdown URL in English must survive unchanged.
        en_urls = set(re.findall(r"\]\(([^)\s]+)\)", _translatable_text(post)))
        tr_urls = set(re.findall(r"\]\(([^)\s]+)\)", _translatable_text(blk)))
        if en_urls != tr_urls:
            bad.append(f"{lang}: link set changed (missing {sorted(en_urls - tr_urls)[:3]}, added {sorted(tr_urls - en_urls)[:3]})")
    return bad


def resolve_slugs(post: dict) -> dict[str, str]:
    """uuid -> slug for every condo the post references (bullets + bodies)."""
    ids = {b["condo_id"] for b in post.get("fact_bullets", []) if b.get("condo_id")}
    ids |= set(UUID_RE.findall(json.dumps(post, ensure_ascii=False)))
    if not ids:
        return {}
    client = get_client()
    out: dict[str, str] = {}
    ids_l = sorted(ids)
    for i in range(0, len(ids_l), 100):
        res = client.table("condos_published").select("id, slug").in_("id", ids_l[i:i + 100]).execute()
        for row in res.data or []:
            if row.get("slug"):
                out[row["id"]] = row["slug"]
    return out


def apply_slugs(post: dict, slugs: dict[str, str]) -> int:
    """Write `slug` onto bullets and replace /condo/<uuid> with /condo/<slug>
    everywhere in the post (English and any translations). Returns the
    number of substitutions made."""
    n = 0
    for b in post.get("fact_bullets", []):
        cid = b.get("condo_id")
        if cid and cid in slugs and b.get("slug") != slugs[cid]:
            b["slug"] = slugs[cid]
            n += 1

    def fix(s: str) -> str:
        nonlocal n
        def rep(m: re.Match) -> str:
            nonlocal n
            u = m.group(1)
            if u in slugs:
                n += 1
                return f"/condo/{slugs[u]}"
            return m.group(0)
        return re.sub(r"/condo/(" + UUID_RE.pattern + ")", rep, s)

    def walk(blk: dict) -> None:
        for k in ("lead", "description"):
            if isinstance(blk.get(k), str):
                blk[k] = fix(blk[k])
        for s in blk.get("sections", []):
            if isinstance(s.get("body"), str):
                s["body"] = fix(s["body"])

    walk(post)
    for lang in LANGS:
        blk = (post.get("i18n") or {}).get(lang)
        if isinstance(blk, dict):
            walk(blk)
    return n


LANG_NAME = {"ko": "Korean", "th": "Thai"}

# Appended to SYSTEM_PROMPT per call. Kept as a plain template rather than an
# f-string with embedded braces: the JSON skeleton below is mostly braces, and
# escaping them inside an f-string is how this line broke the first time.
ONE_LANG_SUFFIX = """

Translate into {name} ONLY. Return that language's object directly, with no
outer language key:

{{"title": ..., "description": ..., "lead": ..., "sections": [...], "fact_bullets": [...]}}
"""


def _one_lang(client, src: dict, lang: str) -> dict:
    """Translate into a single language.

    One language per call rather than both in one response: the combined
    reply ran to ~5k tokens of CJK/Thai with escaped newlines inside every
    body string, and a single mis-escaped quote invalidated the whole
    object — which is how 2026-08-23's post lost both translations to one
    `Expecting ',' delimiter`. Halving the response halves the blast
    radius, and a failure in one language no longer costs the other.
    """
    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT + ONE_LANG_SUFFIX.format(name=LANG_NAME[lang]),
        messages=[{"role": "user", "content": json.dumps(src, ensure_ascii=False, indent=2)}],
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    # Assistant prefill is not available on this model, so the reply can still
    # arrive wrapped in a code fence or trailed by a sentence. Take the
    # outermost balanced {...} rather than trusting the whole string.
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    i, j = text.find("{"), text.rfind("}")
    if i == -1 or j <= i:
        raise json.JSONDecodeError("no JSON object in reply", text, 0)
    return json.loads(text[i:j + 1])


def translate(post: dict) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    client = Anthropic(api_key=api_key)
    src = {k: post[k] for k in ("title", "description", "lead", "sections") if k in post}
    src["fact_bullets"] = [
        {"label": b.get("label", ""), "value": b.get("value", "")}
        for b in post.get("fact_bullets", [])
    ]
    out: dict = {}
    for lang in LANGS:
        last: Exception | None = None
        for attempt in (1, 2):
            try:
                out[lang] = _one_lang(client, src, lang)
                break
            except json.JSONDecodeError as e:
                last = e
                logger.warning(
                    "[localize] {} attempt {} returned invalid JSON: {}", lang, attempt, e
                )
        else:
            raise RuntimeError(f"{lang}: invalid JSON after 2 attempts ({last})")
    return out


def localize(post: dict, *, force: bool = False) -> tuple[dict, list[str]]:
    """Mutates and returns `post`. Second value: problems (empty on full
    success). A translation problem leaves the English post intact and
    i18n absent — publish proceeds in English."""
    problems: list[str] = []

    # Links first, so the English the translator sees already has slugs and
    # the url-preservation audit compares like with like.
    try:
        slugs = resolve_slugs(post)
        n = apply_slugs(post, slugs)
        logger.info("[localize] {}: {} slug substitutions ({} condos resolved)", post["slug"], n, len(slugs))
    except Exception as e:  # noqa: BLE001
        problems.append(f"slug lookup failed: {e}")

    if post.get("i18n") and not force:
        return post, problems

    try:
        tr = translate(post)
    except Exception as e:  # noqa: BLE001
        problems.append(f"translate failed: {e}")
        return post, problems

    bad = audit(post, tr)
    if bad:
        problems.extend(bad)
        logger.error("[localize] {}: translation rejected: {}", post["slug"], bad)
        return post, problems

    post["i18n"] = {lang: tr[lang] for lang in LANGS}
    return post, problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--all", action="store_true", help="every post lacking i18n")
    ap.add_argument("--force", action="store_true", help="re-translate even if i18n exists")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.slug:
        files = [POSTS_DIR / f"{args.slug}.json"]
    elif args.all:
        files = sorted(POSTS_DIR.glob("*.json"))
    else:
        ap.error("pass --slug or --all")
        return 2

    rc = 0
    for fp in files:
        post = json.loads(fp.read_text(encoding="utf-8"))
        if post.get("i18n") and not args.force and args.all:
            # still apply slugs to old posts — cheap, no model call
            slugs = resolve_slugs(post)
            n = apply_slugs(post, slugs)
            if n and not args.dry_run:
                fp.write_text(json.dumps(post, ensure_ascii=False, indent=2), encoding="utf-8")
            logger.info("[localize] {}: already localized; {} slug fixes", post["slug"], n)
            continue
        post, problems = localize(post, force=args.force)
        if problems:
            rc = 1
            for p in problems:
                logger.warning("[localize] {}: {}", post["slug"], p)
        if args.dry_run:
            ko = (post.get("i18n") or {}).get("ko") or {}
            print(f"--- {post['slug']} ---\nko title: {ko.get('title')}\nko lead: {(ko.get('lead') or '')[:200]}")
            continue
        fp.write_text(json.dumps(post, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("[localize] wrote {} (i18n={})", fp.name, bool(post.get("i18n")))
    return rc


if __name__ == "__main__":
    sys.exit(main())
