"""REIC (Real Estate Information Center) Research-Report scraper.

REIC's authoritative numeric tables sit behind /Member/Login + CAPTCHA, so we
scrape only the publicly-accessible Research Report pages
(https://www.reic.or.th/Research/REICReport/{id}). Each report page carries
title + summary text that typically embeds the headline numbers (price index,
YoY %, supply units, absorption rate, etc.) in narrative form.

A separate LLM extraction step (optional) turns that narrative into structured
fields. Without the LLM key, we still capture title + raw text + publish date.
"""
from __future__ import annotations

import re
from typing import Any

import httpx
from bs4 import BeautifulSoup
from loguru import logger

BASE = "https://www.reic.or.th"
HDRS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "th,en;q=0.7",
}

# Thai Buddhist year offset — most REIC reports are dated in the BE calendar
# (พ.ศ.). Subtract 543 to get CE.
BE_OFFSET = 543

_DATE_RE = re.compile(
    r"(\d{1,2})\s+(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|"
    r"สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|"
    r"พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|"
    r"January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})"
)
_THAI_MONTH = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
    "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}


def _parse_date(text: str) -> str | None:
    """Find a Thai or English date string in `text` and return ISO date."""
    m = _DATE_RE.search(text)
    if not m:
        return None
    day = int(m.group(1))
    month_word = m.group(0).split(maxsplit=1)[1].rsplit(maxsplit=1)[0].strip()
    year = int(m.group(2))
    month = _THAI_MONTH.get(month_word)
    if month is None:
        return None
    # Thai BE → CE if year is implausibly future
    if year > 2400:
        year -= BE_OFFSET
    try:
        from datetime import date
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _classify_region(title: str) -> str | None:
    t = title.lower()
    if "eec" in t:
        return "EEC"
    if "ภูเก็ต" in title or "phuket" in t:
        return "Phuket"
    if "กรุงเทพ" in title or "bangkok" in t or "กทม" in title:
        return "Bangkok"
    if "ปริมณฑล" in title:
        return "Bangkok Metropolitan"
    if "ประเทศไทย" in title or "thailand" in t:
        return "National"
    if "จังหวัด" in title or "ภูมิภาค" in title:
        return "Provincial"
    # National-scope indices (construction costs, new-condo price index, aggregate market)
    # never carry a regional qualifier in the title — they're inherently Thailand-wide.
    if "ดัชนีราคาค่าก่อสร้าง" in title or "ดัชนีราคาห้องชุดใหม่" in title or "ดัชนีรวม" in title:
        return "National"
    return None


def _classify_category(title: str) -> str | None:
    t = title.lower()
    if "ดัชนีความเชื่อมั่น" in title or "sentiment" in t or "confidence" in t:
        return "Developer Sentiment"
    if "ดัชนีรวม" in title or "aggregate" in t:
        return "Aggregate Market Index"
    if "ดัชนีราคา" in title or "price index" in t:
        return "Price Index"
    if "อุปทาน" in title or "supply" in t or "หน่วยใหม่" in title:
        return "Supply"
    if "ดูดซับ" in title or "absorption" in t:
        return "Absorption"
    if "ต่างชาติ" in title or "foreign" in t:
        return "Foreign Buyers"
    if "ที่ดิน" in title or "land" in t:
        return "Land Price"
    if "รายงาน" in title or "report" in t:
        return "Market Report"
    return None


def fetch_report(
    client: httpx.Client,
    report_id: int,
) -> dict[str, Any] | None:
    """Fetch one /Research/REICReport/{id} page. Returns dict or None if not
    accessible. Anonymous — no login required for this path."""
    url = f"{BASE}/Research/REICReport/{report_id}"
    try:
        r = client.get(url, headers=HDRS, timeout=30, follow_redirects=True)
    except httpx.HTTPError as e:
        logger.debug(f"[reic] http error for {report_id}: {e}")
        return None
    # Some IDs redirect back to the index — skip them.
    if str(r.url).rstrip("/").split("/")[-1] != str(report_id):
        return None
    if r.status_code != 200:
        return None
    r.encoding = "utf-8"

    soup = BeautifulSoup(r.text, "html.parser")

    # Title — REIC has multiple <h1> tags; the first is the site logo.
    # The article title is the first h1 without a class="logo" / without
    # nested <img>.
    title: str | None = None
    for h in soup.find_all(["h1", "h2"]):
        classes = h.get("class") or []
        if "logo" in classes:
            continue
        if h.find("img"):
            continue
        txt = h.get_text(" ", strip=True)
        if 5 < len(txt) < 250:
            title = txt
            break
    # Fallback to <title>
    if not title:
        t = soup.find("title")
        if t:
            title = re.sub(r"\s*[-|]\s*REIC.*$", "", t.get_text(" ", strip=True)).strip()

    # Body: REIC wraps article content in <div class="content-editor">.
    # There are usually TWO such divs on a report page — the first is a
    # small breadcrumb/category link (~100 chars), the second is the actual
    # article body (~1-3k chars). Pick the longest.
    summary = ""
    content_divs = soup.select(".content-editor")
    if content_divs:
        best = max(content_divs, key=lambda d: len(d.get_text(" ", strip=True)))
        summary = best.get_text(" ", strip=True)[:5000]
    if not summary or len(summary) < 200:
        # Fallback to old behavior if .content-editor structure changes
        body_parts: list[str] = []
        for tag in soup.find_all(["p", "li", "td", "div"]):
            txt = tag.get_text(" ", strip=True)
            if txt and 10 < len(txt) < 2000 and any(c.isalpha() for c in txt):
                body_parts.append(txt)
        summary = "\n".join(dict.fromkeys(body_parts[:30]))[:5000]

    pub_date = _parse_date(r.text)
    region = _classify_region(title or "")
    category = _classify_category(title or "")

    return {
        "reic_id": report_id,
        "title": title,
        "summary": summary,
        "published_at": pub_date,
        "region": region,
        "category": category,
        "url": url,
    }
