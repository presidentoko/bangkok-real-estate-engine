"""Find questions our data answers, and draft the reply a human will post.

Why this exists
---------------
Every technical fix is done: the 7/15 Googlebot 503 is long gone, the empty
pages are gated, the URLs are canonical, and the site now has yield, flood,
quota and comparison pages no portal has. What it does not have is links.
At this stage a handful of real referring domains moves rankings more than
another ten thousand pages.

The only way to earn those safely is a person answering a real question with
a real number. So this script does everything up to the point of posting:

  1. reads Reddit (search RSS) and ASEAN NOW (forum listings) for threads
     about yields, flood risk, foreign quota and condo prices,
  2. pulls the matching numbers out of our own database,
  3. asks the model for a reply that leads with the answer and cites the
     page once, as a source rather than a pitch,
  4. rejects any draft containing a number that is not in those facts,
  5. writes it to outreach_tasks for /admin/outreach, and pings Telegram.

It never posts. Automated forum posting gets the account banned and the
domain treated as a link scheme -- the opposite of the goal. A human edits
the draft, posts it from their own account, and pastes the URL back.

Usage
-----
    python scripts/outreach_scout.py                 # dry run, prints drafts
    python scripts/outreach_scout.py --submit        # write rows + Telegram
    python scripts/outreach_scout.py --limit 5
    python scripts/outreach_scout.py --verify        # weekly: are the links live?
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import requests  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(ROOT, ".env"))

from anthropic import Anthropic  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.notifiers.telegram import send_telegram_message  # noqa: E402

SITE = "https://passionaryestate.com"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 900
UA = "RealDataOutreach/1.0 (+https://passionaryestate.com)"

# Three a day, deliberately. The constraint is not how many threads exist —
# it is how many replies a human can make genuinely useful before they start
# reading as a campaign, which is when a subreddit bans the domain.
DAILY_LIMIT = 3

# Only threads this fresh: a two-week-old question has moved on, and a reply
# there is transparently link-seeking.
MAX_AGE_DAYS = 10

SUBREDDITS = ["Thailand", "Bangkok", "ThailandTourism"]
# One request per subreddit, not one per phrase: fifteen calls in five
# seconds earns a 429 from Reddit, and the feeds are the only door open
# (the JSON endpoints 403 without OAuth).
REDDIT_QUERY = "condo (yield OR quota OR freehold OR flood OR buying OR investment)"
REDDIT_PAUSE_S = 3
# ASEAN NOW forum ids worth watching (property finance, property for sale).
ASEANNOW_FORUMS = ["453-property-finance", "455-property-for-sale-rent"]

# What a thread has to be about for us to have anything to say.
TOPICS = {
    "yield": ["yield", "rental return", "roi", "rental income", "cap rate", "rent out"],
    "flood": ["flood", "flooding", "monsoon", "water damage"],
    "quota": ["foreign quota", "49%", "freehold", "leasehold", "foreign ownership"],
    "price": ["price per sqm", "overpriced", "price trend", "how much is", "cost of a condo"],
}


def _http() -> requests.Session:
    """requests, not httpx: ASEAN NOW's edge answers httpx with 403 and
    requests with 200, on the same URL and the same User-Agent. The UA still
    names us and links back here."""
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return s


# ─────────────────────────────────────────────────────────────────────
# Sources
# ─────────────────────────────────────────────────────────────────────


def reddit_threads(http: requests.Session) -> list[dict]:
    """Reddit's JSON endpoints 403 unauthenticated; the Atom feeds do not."""
    out: list[dict] = []
    for i, sub in enumerate(SUBREDDITS):
        if i:
            time.sleep(REDDIT_PAUSE_S)
        try:
            r = http.get(
                f"https://www.reddit.com/r/{sub}/search.rss",
                params={"q": REDDIT_QUERY, "restrict_sr": 1, "sort": "new", "t": "month", "limit": 50},
                timeout=30,
            )
            if r.status_code != 200:
                logger.warning("[outreach] reddit {} -> {}", sub, r.status_code)
                continue
            root = ET.fromstring(r.text)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[outreach] reddit {} failed: {}", sub, exc)
            continue
        if True:
            ns = {"a": "http://www.w3.org/2005/Atom"}
            for e in root.findall("a:entry", ns):
                title = (e.findtext("a:title", default="", namespaces=ns) or "").strip()
                link = e.find("a:link", ns)
                href = link.get("href") if link is not None else None
                updated = e.findtext("a:updated", default="", namespaces=ns) or ""
                content = re.sub(r"<[^>]+>", " ", e.findtext("a:content", default="", namespaces=ns) or "")
                if not href:
                    continue
                out.append(
                    {
                        "source": f"reddit:r/{sub}",
                        "source_url": href.split("?")[0],
                        "title": title,
                        "excerpt": re.sub(r"\s+", " ", content).strip()[:900],
                        "posted_at": updated or None,
                    }
                )
    return out


def aseannow_threads(http: requests.Session) -> list[dict]:
    """No RSS on this board, so read the forum listing and take the titles."""
    out: list[dict] = []
    for forum in ASEANNOW_FORUMS:
        try:
            r = http.get(f"https://aseannow.com/forum/{forum}/", timeout=30)
            if r.status_code != 200:
                logger.warning("[outreach] aseannow {} -> {}", forum, r.status_code)
                continue
        except Exception as exc:  # noqa: BLE001
            logger.warning("[outreach] aseannow {} failed: {}", forum, exc)
            continue
        found: dict[str, str] = {}
        for url, title in re.findall(
            r'<a href="(https://aseannow\.com/topic/\d+-[^"?#]+/?)"[^>]*>(?:\s*<span[^>]*>)?\s*([^<]{6,120})',
            r.text,
        ):
            url = url.rstrip("/")
            title = re.sub(r"\s+", " ", title).strip()
            if url not in found and title:
                found[url] = title
        for url, title in found.items():
            out.append(
                {
                    "source": f"aseannow:{forum}",
                    "source_url": url,
                    "title": title,
                    "excerpt": "",
                    "posted_at": None,
                }
            )
    return out


def classify(thread: dict) -> str | None:
    text = f"{thread['title']} {thread['excerpt']}".lower()
    for topic, words in TOPICS.items():
        if any(w in text for w in words):
            return topic
    return None


def fresh_enough(thread: dict) -> bool:
    ts = thread.get("posted_at")
    if not ts:
        return True  # ASEAN NOW listings are newest-first already
    try:
        when = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return True
    return when >= datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)


# ─────────────────────────────────────────────────────────────────────
# Our side of the conversation
# ─────────────────────────────────────────────────────────────────────

# Areas we can name in a reply, with the page that proves the number.
def facts_for(client, topic: str, text: str) -> dict:
    """The numbers this reply is allowed to use, read live from our own DB."""
    facts: dict = {"site": SITE}
    lowered = text.lower()

    if topic in ("yield", "price"):
        rows = (
            client.table("condos")
            .select("province, gross_yield_pct, avg_sale_price, regions(name)")
            .gt("gross_yield_pct", 0)
            .lte("gross_yield_pct", 25)
            .gte("avg_sale_price", 500_000)
            .gte("yield_sample_sale", 2)
            .gte("yield_sample_rent", 2)
            .eq("is_active", True)
            .eq("published", True)
            .limit(1000)
            .execute()
            .data
        ) or []
        by_city: dict[str, list[float]] = {}
        for r in rows:
            prov = (r.get("province") or "").replace("-", "")
            if prov:
                by_city.setdefault(prov, []).append(float(r["gross_yield_pct"]))
        medians = {
            city: round(sorted(v)[len(v) // 2], 1)
            for city, v in by_city.items()
            if len(v) >= 8
        }
        facts["median_gross_yield_pct_by_city"] = medians
        facts["buildings_measured"] = len(rows)
        facts["yield_page"] = f"{SITE}/en/yields"
        for city in medians:
            if city in lowered.replace(" ", ""):
                facts["area_page"] = f"{SITE}/en/yield/{city}"

    if topic == "flood":
        facts["flood_page"] = f"{SITE}/en/flood"
        facts["flood_note"] = "All 50 Bangkok khet scored 0-5 from BMA drainage records, JICA reports and 2011 inundation mapping."

    if topic == "quota":
        rows = (
            client.table("condos")
            .select("foreign_quota_inventory_pct")
            .gte("total_quota_listings_observed", 5)
            .not_.is_("foreign_quota_inventory_pct", "null")
            .eq("published", True)
            .eq("is_active", True)
            .limit(1000)
            .execute()
            .data
        ) or []
        pcts = [float(r["foreign_quota_inventory_pct"]) for r in rows]
        if pcts:
            facts["buildings_with_quota_data"] = len(pcts)
            facts["share_with_plenty_of_foreign_quota_pct"] = round(
                100 * sum(1 for p in pcts if p >= 60) / len(pcts)
            )
        facts["quota_page"] = f"{SITE}/en/guide/foreign-quota"

    return facts


SYSTEM_PROMPT = """You draft a forum reply for a person to post under their own name.

The person runs RealData, a site that measures Thai condo listings. They are
not selling anything in this reply. They are answering the question.

Rules:
- Answer in the first two sentences, with the number from FACTS. No preamble.
- Use ONLY numbers that appear in FACTS. If FACTS has no number for the
  question, say what the data does and does not cover instead of guessing.
- One link, at the end, as the source of the number. Never more than one.
- Disclose in a half-sentence that the site is theirs. "I run the site that
  tracks this" is enough.
- Plain first-person English. No marketing words, no bullet lists, no
  headings, no emoji. 60-110 words.
- Say what the number does not prove. A person who names a limitation reads
  as a person; a person who only sells reads as a bot.

Return JSON only: {"draft": "..."}"""


def draft_reply(thread: dict, topic: str, facts: dict) -> str | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    payload = {
        "QUESTION_TITLE": thread["title"],
        "QUESTION_EXCERPT": thread["excerpt"][:600],
        "TOPIC": topic,
        "FACTS": facts,
    }
    resp = Anthropic(api_key=api_key).messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=2)}],
    )
    text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)["draft"].strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[outreach] model returned unusable output: {} ({})", text[:200], exc)
        return None


def numbers_in(text: str) -> set[str]:
    return {n.rstrip(".") for n in re.findall(r"\d+(?:\.\d+)?", text)}


def audit(draft: str, facts: dict) -> list[str]:
    """Same guard as the weekly post: a number not in FACTS is a fabrication."""
    allowed = numbers_in(json.dumps(facts, ensure_ascii=False))
    allowed |= {"1", "2", "3", "4", "5", "10", "12", "49", "50", "100", "2026"}
    return sorted(numbers_in(draft) - allowed)


# ─────────────────────────────────────────────────────────────────────


def verify_links(client) -> int:
    """Weekly: is the comment still there, and does it still carry our link?"""
    rows = (
        client.table("outreach_tasks")
        .select("id, result_url")
        .eq("status", "posted")
        .not_.is_("result_url", "null")
        .limit(200)
        .execute()
        .data
    ) or []
    alive = 0
    http = _http()
    if True:
        for r in rows:
            try:
                resp = http.get(r["result_url"], timeout=30)
                ok = resp.status_code == 200 and "passionaryestate.com" in resp.text
            except Exception:  # noqa: BLE001
                ok = False
            alive += 1 if ok else 0
            client.table("outreach_tasks").update(
                {
                    "link_checked_at": datetime.now(timezone.utc).isoformat(),
                    "link_alive": ok,
                }
            ).eq("id", r["id"]).execute()
    logger.info("[outreach] verified {} posted links, {} alive", len(rows), alive)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--submit", action="store_true", help="write rows (default: dry run)")
    ap.add_argument("--limit", type=int, default=DAILY_LIMIT)
    ap.add_argument("--verify", action="store_true", help="check the links already posted")
    args = ap.parse_args()

    client = get_client()
    if args.verify:
        return verify_links(client)

    # A dry run works before migration 020 has been applied, so the table
    # missing is not an error here.
    try:
        seen = {
            r["source_url"]
            for r in (client.table("outreach_tasks").select("source_url").limit(5000).execute().data or [])
        }
    except Exception as exc:  # noqa: BLE001
        if args.submit:
            raise
        logger.warning("[outreach] outreach_tasks not readable ({}), continuing dry run", exc)
        seen = set()

    http = _http()
    threads = reddit_threads(http) + aseannow_threads(http)
    logger.info("[outreach] {} threads seen across sources", len(threads))

    candidates: list[tuple[dict, str]] = []
    for t in threads:
        if t["source_url"] in seen or not fresh_enough(t):
            continue
        topic = classify(t)
        if not topic:
            continue
        # Someone already linked us there, or it is our own post.
        if "passionaryestate" in (t["title"] + t["excerpt"]).lower():
            continue
        candidates.append((t, topic))
        seen.add(t["source_url"])

    logger.info("[outreach] {} on-topic and unseen", len(candidates))
    written = 0
    for thread, topic in candidates:
        if written >= args.limit:
            break
        facts = facts_for(client, topic, f"{thread['title']} {thread['excerpt']}")
        draft = draft_reply(thread, topic, facts)
        if not draft:
            continue
        bad = audit(draft, facts)
        if bad:
            logger.warning("[outreach] dropped draft with unsupported numbers {}: {}", bad, thread["source_url"])
            continue

        print(f"\n--- {thread['source']} · {topic}\n{thread['title']}\n{thread['source_url']}\n\n{draft}\n")
        written += 1
        if not args.submit:
            continue
        client.table("outreach_tasks").insert(
            {
                "kind": "community",
                "source": thread["source"],
                "source_url": thread["source_url"],
                "source_title": thread["title"][:300],
                "source_excerpt": thread["excerpt"][:1000] or None,
                "posted_at": thread["posted_at"],
                "draft_body": draft,
                "facts": facts,
                "topic": topic,
            }
        ).execute()

    if args.submit and written:
        send_telegram_message(
            os.environ.get("TELEGRAM_CHAT_ID", ""),
            f"{written} outreach draft(s) ready: {SITE}/admin/outreach",
            parse_mode="",
        )
    logger.info("[outreach] {} draft(s) {}", written, "written" if args.submit else "(dry run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
