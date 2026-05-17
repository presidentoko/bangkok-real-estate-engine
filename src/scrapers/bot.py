"""Bank of Thailand (BOT) BTWS_STAT public statistics fetcher.

BOT publishes macroeconomic & financial indicators at
  https://app.bot.or.th/BTWS_STAT/statistics/BOTWEBSTAT.aspx?reportID={id}&language=ENG

Each report renders an HTML grid (table#dgExcel) with period columns + indicator
rows. We parse the default-load grid (which already shows the latest periods —
no ASP.NET postback needed for our purposes).

Anchored series:
  223  FM_RT_001_S2   Interest Rates in Financial Market (incl. Policy Rate, BIBOR, MLR/MOR/MRR)
  409  EC_EI_027      Macro Economic Indicators
  680  EC_EI_008_S2   House Price Index (stale at 2021 as of 2026-05; kept for completeness)
  775  EC_MB_039      Loans to Household

No auth, no API key. Default desktop User-Agent only.
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

import httpx
from bs4 import BeautifulSoup
from loguru import logger

BASE = "https://app.bot.or.th/BTWS_STAT/statistics/BOTWEBSTAT.aspx"
HDRS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
}

REPORTS: dict[int, tuple[str, str]] = {
    223: ("FM_RT_001_S2", "Interest Rates in Financial Market"),
    409: ("EC_EI_027",    "Macro Economic Indicators"),
    680: ("EC_EI_008_S2", "House Price Index"),
    775: ("EC_MB_039",    "Loans to Household"),
}

_MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}
_MONTH_RE = re.compile(r"^([A-Z]{3})[\s/]+(\d{4})\s*([pr])?$", re.IGNORECASE)
_QTR_RE = re.compile(r"^Q([1-4])[\s/]+(\d{4})\s*([pr])?$", re.IGNORECASE)
_YEAR_RE = re.compile(r"^(\d{4})\s*([pr])?$")


def _parse_period(s: str) -> tuple[date, bool] | None:
    """Parse a BOT period label like 'JUL 2025 p' or 'Q2 2024' → (date, is_provisional).

    Months → first of month. Quarters → first of the quarter's first month.
    Annual → Jan 1 of that year.
    """
    s = (s or "").strip()
    if not s:
        return None
    m = _MONTH_RE.match(s)
    if m:
        mon = _MONTHS.get(m.group(1).upper())
        if not mon:
            return None
        return date(int(m.group(2)), mon, 1), bool(m.group(3))
    m = _QTR_RE.match(s)
    if m:
        q = int(m.group(1))
        return date(int(m.group(2)), (q - 1) * 3 + 1, 1), bool(m.group(3))
    m = _YEAR_RE.match(s)
    if m:
        return date(int(m.group(1)), 1, 1), bool(m.group(2))
    return None


_GENERIC_LABEL_RE = re.compile(
    r"^(?:O/N|\d+\s*(?:day|days|week|weeks|month|months|year|years|Year))\s*$",
    re.IGNORECASE,
)


def _is_generic_label(s: str) -> bool:
    """True when the label looks like a tenor ('1 week', 'O/N', '3 months')
    that only makes sense paired with its parent section."""
    return bool(_GENERIC_LABEL_RE.match(s.strip()))


def _to_float(s: str) -> float | None:
    v = (s or "").strip()
    if not v or v.lower() in ("n.a.", "n/a", "-", "..", ""):
        return None
    # strip trailing/leading provisional or revision flags ('p', 'r')
    v = re.sub(r"[pr]$", "", v).strip()
    try:
        return float(v.replace(",", ""))
    except ValueError:
        return None


def fetch_bot_report(report_id: int) -> list[dict[str, Any]]:
    """Pull one BOT BTWS_STAT report and return a list of long-form rows:
      {series_code, indicator_name, period (ISO date), value, is_provisional}
    """
    if report_id not in REPORTS:
        raise ValueError(f"unknown BOT report_id {report_id}")
    series_code, label = REPORTS[report_id]
    url = f"{BASE}?reportID={report_id}&language=ENG"
    logger.info(f"[bot] fetching {series_code} ({label}) from {url}")

    r = httpx.get(url, headers=HDRS, timeout=60, follow_redirects=True)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    grid = soup.find("table", id="dgExcel")
    if not grid:
        logger.warning(f"[bot] dgExcel grid not found in {series_code}")
        return []

    rows = grid.find_all("tr")
    if len(rows) < 2:
        return []

    # Row 0 = period headers. First two cells are row#/label spacers.
    header_cells = [td.get_text(strip=True) for td in rows[0].find_all(["td", "th"])]
    periods: list[tuple[date, bool] | None] = []
    for c in header_cells[2:]:
        periods.append(_parse_period(c))

    out: list[dict[str, Any]] = []
    current_section: str | None = None
    seen_keys: set[tuple[str, str]] = set()  # (indicator_name, period_iso)
    for tr in rows[1:]:
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if len(cells) < 3:
            continue
        indicator = cells[1].strip()
        if not indicator:
            continue
        # Trim trailing footnote markers like ' 1/', ' 2/', etc.
        indicator = re.sub(r"\s+\d+/$", "", indicator).strip()

        # Rows with no numeric values are section headers
        # (e.g. "Bilateral repurchase rate", "BIBOR"). Track the most recent
        # one and prefix subsequent child rows so children with the same
        # short label ("1 week", "1 month") don't collide on the unique key.
        has_values = any(_to_float(v) is not None for v in cells[2:])
        if not has_values:
            current_section = indicator
            continue

        # Short generic labels need their parent section prefixed.
        if current_section and _is_generic_label(indicator):
            full_indicator = f"{current_section}: {indicator}"
        else:
            full_indicator = indicator

        for i, raw in enumerate(cells[2:]):
            if i >= len(periods) or not periods[i]:
                continue
            value = _to_float(raw)
            if value is None:
                continue
            period, period_provisional = periods[i]
            cell_provisional = raw.strip().endswith(("p", "P"))
            key = (full_indicator, period.isoformat())
            if key in seen_keys:
                # Same indicator+period appeared earlier in this report —
                # keep the first occurrence to stay idempotent.
                continue
            seen_keys.add(key)
            out.append({
                "series_code": series_code,
                "indicator_name": full_indicator,
                "period": period.isoformat(),
                "value": value,
                "is_provisional": period_provisional or cell_provisional,
            })

    logger.info(
        f"[bot] {series_code}: parsed {len(out)} rows "
        f"({len(set((r['indicator_name'] for r in out)))} indicators × "
        f"{len([p for p in periods if p])} periods)"
    )
    return out


def fetch_all(report_ids: list[int] | None = None) -> list[dict[str, Any]]:
    ids = report_ids or list(REPORTS.keys())
    all_rows: list[dict[str, Any]] = []
    for rid in ids:
        try:
            all_rows.extend(fetch_bot_report(rid))
        except Exception as e:
            logger.error(f"[bot] reportID={rid} failed: {e}")
    return all_rows
