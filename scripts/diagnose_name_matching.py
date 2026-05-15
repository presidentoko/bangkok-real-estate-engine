"""Diagnose cross-source name matching quality.

Loads the hipflat name index and a sample of DotProperty project names from
the DB, then shows:
  - Top unmatched DP names (raw + normalized)
  - Likely causes: "the" prefix, " bangkok" suffix, "condominium" suffix, etc.
  - Candidate near-matches from the hipflat index (edit-distance ≤ 3)

Usage:
  python scripts/diagnose_name_matching.py [--limit 200]
"""
from __future__ import annotations

import argparse
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import _normalize_project_name, build_hipflat_name_index, get_client


# ── strip helpers we want to TEST ───────────────────────────────────────────

def _strip_common(norm: str) -> str:
    """Strip 'the' prefix and common suffix words that often differ."""
    import re
    s = norm
    s = re.sub(r"^the", "", s)
    for suffix in ("bangkok", "bkk", "condominium", "condo", "residences",
                   "residence", "tower", "towers", "project"):
        if s.endswith(suffix) and len(s) > len(suffix) + 3:
            s = s[: -len(suffix)]
    return s.strip()


def levenshtein(a: str, b: str) -> int:
    if abs(len(a) - len(b)) > 4:
        return 99
    dp = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        ndp = [i + 1]
        for j, cb in enumerate(b):
            ndp.append(min(dp[j] + (ca != cb), dp[j + 1] + 1, ndp[-1] + 1))
        dp = ndp
    return dp[-1]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=300,
                    help="Max DP project names to sample from DB")
    ap.add_argument("--show", type=int, default=40,
                    help="How many unmatched names to print")
    args = ap.parse_args()

    client = get_client()

    print("Loading hipflat name index...")
    hipflat_idx = build_hipflat_name_index(client)
    hipflat_norms = set(hipflat_idx.keys())
    print(f"  {len(hipflat_norms)} hipflat condos indexed")

    print("Loading DotProperty project names from DB (condos.name where source=dotproperty)...")
    rows = (
        client.table("condos")
        .select("name")
        .eq("source", "dotproperty")
        .not_.is_("name", "null")
        .limit(args.limit)
        .execute()
        .data
    ) or []
    dp_names_raw = list({r["name"] for r in rows if r.get("name")})
    print(f"  {len(dp_names_raw)} unique project names sampled")

    # ── classify each DP name ──────────────────────────────────────────────
    matched_exact = []
    matched_stripped = []
    unmatched = []

    for raw in dp_names_raw:
        norm = _normalize_project_name(raw)
        if norm in hipflat_norms:
            matched_exact.append((raw, norm))
            continue
        stripped = _strip_common(norm)
        if stripped and stripped in hipflat_norms:
            matched_stripped.append((raw, norm, stripped))
            continue
        unmatched.append((raw, norm, stripped))

    total = len(dp_names_raw)
    print(f"\n{'─'*60}")
    print(f"  Exact match (current logic):  {len(matched_exact):>4} / {total}  ({100*len(matched_exact)/max(total,1):.1f}%)")
    print(f"  Match after strip-common:     {len(matched_stripped):>4} / {total}  ({100*len(matched_stripped)/max(total,1):.1f}%)")
    print(f"  Still unmatched:              {len(unmatched):>4} / {total}  ({100*len(unmatched)/max(total,1):.1f}%)")
    print(f"{'─'*60}")

    # ── show strip-common gains ────────────────────────────────────────────
    if matched_stripped:
        print(f"\n[WOULD MATCH with strip-common] (first {min(20, len(matched_stripped))})")
        for raw, norm, stripped in matched_stripped[:20]:
            hipflat_name = next(
                (k for k, v in hipflat_idx.items() if v == hipflat_idx[stripped]), "?"
            )
            print(f"  DP: {raw!r:50s}  →  hipflat key: {stripped!r}")

    # ── show still-unmatched with near-miss candidates ─────────────────────
    print(f"\n[STILL UNMATCHED] (first {args.show})")
    hipflat_list = sorted(hipflat_norms)
    for raw, norm, stripped in unmatched[: args.show]:
        # find closest hipflat key by edit distance
        candidates = sorted(
            ((levenshtein(stripped or norm, h), h) for h in hipflat_list),
            key=lambda x: x[0],
        )[:3]
        near = ", ".join(f"{h!r}(d={d})" for d, h in candidates if d <= 5)
        print(f"  {raw!r:50s}  norm={norm!r:40s}  near=[{near}]")

    # ── pattern analysis on unmatched ──────────────────────────────────────
    import re
    print("\n[PATTERN ANALYSIS on unmatched raw names]")
    has_the    = sum(1 for r, *_ in unmatched if re.match(r"(?i)^the\b", r))
    has_bkk    = sum(1 for r, *_ in unmatched if re.search(r"(?i)\bbangkok\b|\bbkk\b", r))
    has_condo  = sum(1 for r, *_ in unmatched if re.search(r"(?i)\bcondo(minium)?\b", r))
    has_res    = sum(1 for r, *_ in unmatched if re.search(r"(?i)\bresidence[s]?\b", r))
    has_thai   = sum(1 for r, *_ in unmatched if any(ord(c) > 0x0E00 for c in r))
    print(f"  starts with 'The ':   {has_the} / {len(unmatched)}")
    print(f"  contains 'Bangkok':   {has_bkk} / {len(unmatched)}")
    print(f"  contains 'Condo*':    {has_condo} / {len(unmatched)}")
    print(f"  contains 'Residence': {has_res} / {len(unmatched)}")
    print(f"  contains Thai chars:  {has_thai} / {len(unmatched)}")


if __name__ == "__main__":
    main()
