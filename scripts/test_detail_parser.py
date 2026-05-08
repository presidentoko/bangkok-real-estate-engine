"""Quick smoke test for src.scrapers.hipflat_detail.parse_detail_html.

Reads the Paragon 31 raw HTML fixture (saved during Phase 1 probing) and
prints the parsed dict. No network calls. Run after `pip install beautifulsoup4`.

  python scripts/test_detail_parser.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Make `src.*` importable when running from repo root.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.scrapers.hipflat_detail import parse_detail_html

FIXTURE = ROOT / "scripts" / "probes" / "hipflat-project-paragon-31.html"
URL = "https://www.hipflat.co.th/en/projects/paragon-31-ukvsxa"


def main() -> int:
    html = FIXTURE.read_text(encoding="utf-8", errors="ignore")
    result = parse_detail_html(html, url=URL)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sig = result["_signal_completeness"]
    missing = [k for k, v in sig.items() if not v]
    if missing:
        print(f"\n[!] missing signals: {missing}", file=sys.stderr)
        return 1
    print("\n[OK] all Tier-A signals present", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
