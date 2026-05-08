"""Smoke test for src.scrapers.hipflat_detail_b.parse_detail_html_b.

Runs against every saved live probe (scripts/probes/live/*.html), prints a
summary per file, and asserts core Tier-B selectors fire on at least the
buildings that should have them.

  python scripts/test_detail_parser_b.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.scrapers.hipflat_detail_b import parse_detail_html_b

LIVE_DIR = ROOT / "scripts" / "probes" / "live"


def main() -> int:
    files = sorted(LIVE_DIR.glob("*.html"))
    if not files:
        print(f"no fixtures in {LIVE_DIR}", file=sys.stderr)
        return 1
    any_ok = False
    for f in files:
        html = f.read_text(encoding="utf-8", errors="ignore")
        url = f"https://www.hipflat.co.th/en/projects/{f.stem}"
        r = parse_detail_html_b(html, url=url)
        b = r["tier_b"]
        sig = b["_signal_completeness"]
        line = (
            f"{f.stem[:38]:38} | "
            f"units={sig['n_units']:>2} "
            f"facil={sig['n_facilities']:>2} "
            f"market={'Y' if sig['has_market'] else '-'} "
            f"chart_pts={sig['n_chart_points']:>3} "
            f"nearby={sig['n_neighbours']:>2}"
        )
        print(line)
        if sig["n_units"] > 0 or sig["n_facilities"] > 0 or sig["has_chart"]:
            any_ok = True
    if not any_ok:
        print("\n[!] no Tier B signals found in any fixture", file=sys.stderr)
        return 2

    # Drill-down on Avora 31 (richest fixture)
    avora = LIVE_DIR / "avora-31-tcvfur.html"
    if avora.exists():
        html = avora.read_text(encoding="utf-8", errors="ignore")
        r = parse_detail_html_b(html, url="https://www.hipflat.co.th/en/projects/avora-31-tcvfur")
        b = r["tier_b"]
        print("\n--- Avora 31 sample dump ---")
        print(f"facilities: {b['facilities']}")
        print(f"parking/lifts: {b['parking_and_lifts']}")
        if b["units"]:
            print(f"first unit: {json.dumps(b['units'][0], ensure_ascii=False, indent=2)}")
        if b["market_summary"]:
            print(f"market summary: {json.dumps(b['market_summary'], ensure_ascii=False, indent=2)}")
        if b["price_charts"]:
            c = b["price_charts"][0]
            print(f"chart[0] period={c['period']} metric={c['metric']} currency={c['currency']} "
                  f"first 3 pts: {c['points'][:3]} ... last 3: {c['points'][-3:]}")
        if b["neighbours"]:
            print(f"neighbours: {[n['slug'] for n in b['neighbours']][:5]} (n={len(b['neighbours'])})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
