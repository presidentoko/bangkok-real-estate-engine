"""Turn this week's verified post into copy-paste distribution kits.

Why this exists
---------------
The site has never had a distribution channel other than Google, and the
operator's one unfair advantage — native Korean, with 15k Thai condos of
data and /ko pages already built — goes unused because Naver does not
surface external sites the way it surfaces Naver blogs. The weekly post
is generated in English for the site; nothing turned it into the thing a
Korean reader on Naver would actually find.

So: take the post generate_weekly_post.py already wrote and VERIFIED (every
number in fact_bullets was re-queried against the DB before publish), and
produce from it

  1. a Korean Naver-blog post, written to how Naver ranks (keyword in the
     title, short paragraphs, the numbers up front, the site link at the
     end so the blog post itself is the thing Naver indexes), and
  2. a one-paragraph English community post (Reddit / Facebook / ASEAN NOW),
     first-person, method-first, no marketing voice,

and drop both into Telegram as .txt documents (not messages — a message is
capped at 4,096 chars and loses line breaks on copy; a document opens
clean on a phone and pastes as-is).

Why the model sees only the post JSON and not the DB: the post's numbers
are already verified. Giving the model a second source of truth would give
it a way to disagree with the first. It is told, hard, to use no figure
that is not in the input — and the output is checked for exactly that
before it is sent (see _numbers_in / audit_numbers).

Cost: one Sonnet call per week, ~3k output tokens. Runs after the auto-blog
step in weekly-refresh.yml; exits 0 quietly if there is no post this week.

Usage
-----
    python scripts/distribute_weekly_post.py                # latest post
    python scripts/distribute_weekly_post.py --slug foreign-quota-2026-08-23
    python scripts/distribute_weekly_post.py --dry-run      # print, don't send
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from anthropic import Anthropic  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402

POSTS_DIR = ROOT / "web" / "content" / "weekly"
SITE = os.environ.get("NEXT_PUBLIC_SITE_URL", "https://passionaryestate.com")
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4000

# Naver keyword the title must carry, per topic. The auto-blog's topics are
# fixed (TOPICS in generate_weekly_post.py); this maps each to the phrase a
# Korean reader types, so the title ranks for the query that exists rather
# than the one we wish existed.
TOPIC_KEYWORD = {
    "spread": "방콕 콘도 수익률",
    "foreign-quota": "방콕 콘도 외국인 쿼터",
    "city-spotlight": "{city} 콘도 시세",
}

SYSTEM_PROMPT = """You are a Korean real-estate data writer producing two distribution pieces from ONE verified weekly post. You will receive the post as JSON plus a map from condo_id to the condo's public page URL.

HARD RULE — numbers. Every figure you write (counts, percentages, prices, yields, dates, building names) must appear verbatim in the input JSON. Do not compute, round, convert currency, or add any number that is not there. If you want to say something and the number isn't in the input, say it without the number. This is checked mechanically after you answer; a post with an invented number is discarded.

HARD RULE — links. Condo names link to the URL given in condo_urls for that condo_id. Nothing else gets a URL except the single site link at the end.

Return ONLY a JSON object with exactly these keys:

{
  "naver_title": string,
  "naver_body": string,
  "naver_tags": [string, ...],
  "community_title": string,
  "community_body": string
}

=== naver_title ===
Korean. 25–40 characters. MUST contain the provided keyword phrase verbatim, early. Pattern: "<keyword> — <the finding>, <period>". No clickbait punctuation, no emoji. Example shape: "방콕 콘도 외국인 쿼터 100% 남은 단지 5곳 (2026년 8월 기준)".

=== naver_body ===
Korean, polite-declarative (~합니다/~입니다). Plain text, NOT markdown. Write for Naver's layout:
- Paragraphs of 1–3 sentences, separated by one blank line.
- Open with the finding in the first two sentences, then a line that says what the site is in one sentence — name it exactly "RealData (passionaryestate.com)": 태국 포털 4곳에서 수집한 콘도 데이터로 시세·수익률·외국인 쿼터를 측정하는 독립 데이터 사이트이며 개발사 광고를 받지 않는다는 점.
- One short section per building or finding. Section titles on their own line, prefixed with "■ ". Under each, the key numbers first, then one or two sentences of what it means for a buyer or renter.
- Mark where a screenshot goes with a line exactly like: [이미지: 설명]. Use 2–3 of these — the reader on Naver expects images, and the operator will paste screenshots of the site page there.
- Include a short "이 숫자는 어떻게 나왔나" paragraph: data source is the post's own sources; the site re-verifies each figure against its database before publishing.
- Close with: one sentence of honest caveat (data lags the market; a 100% foreign-quota figure means 100% of OBSERVED listings, not a legal guarantee), then the line "전체 데이터와 건물별 상세 보기:" followed by the URL given as site_post_url_ko, then the condo links each on its own line as "건물명 — URL".
- 900–1500 Korean characters of prose, not counting the URL lines.
- Never say "블로그", "홍보", "추천합니다", "구매하세요". This is a data note, not a sales post.

=== naver_tags ===
8–12 Korean hashtag strings without the # sign. Must include 방콕콘도, 태국부동산, 방콕부동산, plus topic-specific terms and the building or district names in Korean where natural.

=== community_title ===
English, first person, under 100 characters, states the method or the data, not the site. e.g. "I checked foreign-quota availability across 11,000 Bangkok condos — five buildings still at 100%". No brand name in the title.

=== community_body ===
English, 120–220 words, plain text with blank lines between paragraphs. First person. Open with what you measured and how (the data source and the verification step). Then the finding with the numbers. Then one paragraph of honest limits. End with: the URL given as site_post_url_en (English readers get the English page), then "Happy to answer questions about the method." No marketing adjectives ("amazing", "must-see", "best"), no exclamation marks, no emoji.
"""


def latest_post_path() -> Path | None:
    files = sorted(POSTS_DIR.glob("*.json"))
    return files[-1] if files else None


def load_post(slug: str | None) -> dict | None:
    fp = (POSTS_DIR / f"{slug}.json") if slug else latest_post_path()
    if not fp or not fp.exists():
        return None
    return json.loads(fp.read_text(encoding="utf-8"))


def condo_urls(post: dict) -> dict[str, str]:
    """condo_id -> /ko/condo/<slug> for every condo the post cites.

    Slugs come from condos_published, which is the same view the detail
    route reads — so a URL produced here is one that resolves, not a
    /condo/<uuid> that meta-refreshes. Condos without a slug are omitted
    and the model is told to render them as plain names.
    """
    ids = sorted({b["condo_id"] for b in post.get("fact_bullets", []) if b.get("condo_id")})
    if not ids:
        return {}
    client = get_client()
    out: dict[str, str] = {}
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        res = client.table("condos_published").select("id, slug").in_("id", chunk).execute()
        for row in res.data or []:
            if row.get("slug"):
                out[row["id"]] = f"{SITE}/ko/condo/{row['slug']}"
    return out


def keyword_for(post: dict) -> str:
    topic = post.get("topic", "")
    kw = TOPIC_KEYWORD.get(topic, "방콕 콘도")
    if "{city}" in kw:
        # city-spotlight slugs look like city-spotlight-chiang-mai-2026-08-09
        m = re.match(r"city-spotlight-(.+)-\d{4}-\d{2}-\d{2}$", post.get("slug", ""))
        city = (m.group(1) if m else "bangkok").replace("-", " ")
        ko = {
            "bangkok": "방콕", "phuket": "푸켓", "chiang mai": "치앙마이",
            "pattaya": "파타야", "hua hin": "후아힌", "chon buri": "촌부리",
        }.get(city, city)
        kw = kw.format(city=ko)
    return kw


def call_model(post: dict, urls: dict[str, str], keyword: str) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    client = Anthropic(api_key=api_key)
    payload = {
        "post": post,
        "condo_urls": urls,
        "site_post_url_ko": f"{SITE}/ko/blog/weekly/{post['slug']}",
        "site_post_url_en": f"{SITE}/en/blog/weekly/{post['slug']}",
        "keyword": keyword,
        "today": date.today().isoformat(),
    }
    resp = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=2)}],
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)


# Numbers the model may use: every digit-run in the source post, plus the
# year/month of the publish date and of today (so "2026년 8월" is allowed).
_NUM_RE = re.compile(r"\d+(?:[.,]\d+)*")


def _numbers_in(text: str) -> set[str]:
    return {n.replace(",", "") for n in _NUM_RE.findall(text)}


def audit_numbers(kit: dict, post: dict, urls: dict[str, str]) -> list[str]:
    allowed = _numbers_in(json.dumps(post, ensure_ascii=False))
    allowed |= _numbers_in(" ".join(urls.values()))
    allowed |= _numbers_in(SITE)
    today = date.today()
    allowed |= {str(today.year), str(today.month), f"{today.month:02d}", str(today.day), f"{today.day:02d}"}
    pub = post.get("published_at", "")
    allowed |= _numbers_in(pub)
    if pub:
        try:
            d = date.fromisoformat(pub)
            allowed |= {str(d.month), str(d.day)}
        except ValueError:
            pass
    bad: list[str] = []
    for key in ("naver_title", "naver_body", "community_title", "community_body"):
        for n in _numbers_in(kit.get(key, "")):
            # Allow short ordinal-ish numbers (1–12) — section numbering,
            # "5 buildings" where 5 bullets exist, month names.
            if n in allowed or (n.isdigit() and int(n) <= 12):
                continue
            bad.append(f"{key}: {n}")
    return bad


def render_naver(kit: dict) -> str:
    tags = " ".join("#" + t.strip().lstrip("#") for t in kit.get("naver_tags", []))
    return f"{kit['naver_title']}\n\n{kit['naver_body'].strip()}\n\n{tags}\n"


def render_community(kit: dict) -> str:
    return f"{kit['community_title']}\n\n{kit['community_body'].strip()}\n"


def telegram_send_document(filename: str, content: str, caption: str) -> bool:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_CHAT_ID")
    if not (token and chat):
        logger.warning("[distribute] TELEGRAM_* not set; not sending")
        return False
    import requests
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{token}/sendDocument",
            data={"chat_id": chat, "caption": caption[:1000]},
            files={"document": (filename, content.encode("utf-8"), "text/plain")},
            timeout=20,
        )
        return r.ok
    except Exception as e:  # noqa: BLE001
        logger.error("[distribute] telegram send failed: {}", e)
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    post = load_post(args.slug)
    if not post:
        logger.info("[distribute] no weekly post found; nothing to do")
        return 0

    # Only distribute a post written this week. The auto-blog skips thin
    # weeks; re-sending last week's kit would just be noise in the chat.
    if not args.slug:
        pub = post.get("published_at", "")
        try:
            age = (date.today() - date.fromisoformat(pub)).days
        except ValueError:
            age = 999
        if age > 6:
            logger.info("[distribute] latest post is {}d old; skipping", age)
            return 0

    urls = condo_urls(post)
    keyword = keyword_for(post)
    logger.info("[distribute] post={} keyword={} condo_urls={}", post["slug"], keyword, len(urls))

    kit = call_model(post, urls, keyword)
    bad = audit_numbers(kit, post, urls)
    if bad:
        logger.error("[distribute] model introduced numbers not in the post: {}", bad)
        return 1
    if keyword not in kit.get("naver_title", ""):
        logger.error("[distribute] naver_title missing keyword {!r}: {!r}", keyword, kit.get("naver_title"))
        return 1

    naver = render_naver(kit)
    community = render_community(kit)

    if args.dry_run:
        print("=" * 70 + "\nNAVER\n" + "=" * 70 + "\n" + naver)
        print("=" * 70 + "\nCOMMUNITY\n" + "=" * 70 + "\n" + community)
        return 0

    stamp = post.get("published_at", date.today().isoformat())
    ok1 = telegram_send_document(
        f"naver-{stamp}.txt", naver,
        "📝 네이버 블로그용 — 제목 줄 복사 → 제목, 나머지 → 본문. [이미지: …] 자리에 사이트 스크린샷. 마지막 줄 해시태그.",
    )
    ok2 = telegram_send_document(
        f"community-{stamp}.txt", community,
        "🌐 Reddit r/Thailand · Bangkok Expats(FB) · ASEAN NOW 용 — 첫 줄이 제목. 이미지 포스트로 올리고 본문은 첫 댓글에.",
    )
    return 0 if (ok1 and ok2) else 1


if __name__ == "__main__":
    sys.exit(main())
