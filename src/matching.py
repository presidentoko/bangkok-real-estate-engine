"""Fuzzy name-matching for cross-source condo dedup.

Exact + aggressive normalizers (in src.db) cover the easy cases. This
adds Levenshtein-edit-distance matching for the long tail: typos,
swapped digits ("park2-4" vs "park24"), trailing single-letter suffixes
("noble be33" vs "noble be33a").

No external lib — pure-Python DP. To keep it fast across 1.9k × 5k
candidate pairs we:
  1. Bucket the index by normalized first character.
  2. Skip pairs where the length gap exceeds the threshold.
  3. Use the standard wraparound DP that exits early on row distance > max.

Typical bucket size: ~80 entries (the alphabet of normalized names is
heavily concentrated in a-z + 0-9, so ~36 buckets average to 50-100
each). Per-orphan work: 50 candidate distance computations on strings
of <40 chars → microseconds.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Iterable


def levenshtein(a: str, b: str, max_dist: int = 2) -> int:
    """Edit distance with early exit. Returns max_dist+1 if it would
    exceed max_dist (saves work — we don't need the exact number when
    we're filtering)."""
    la, lb = len(a), len(b)
    if abs(la - lb) > max_dist:
        return max_dist + 1
    if la == 0:
        return lb
    if lb == 0:
        return la
    # Ensure a is the shorter for memory efficiency
    if la > lb:
        a, b = b, a
        la, lb = lb, la
    # Standard row-by-row DP
    prev = list(range(la + 1))
    for j, cb in enumerate(b, 1):
        curr = [j] + [0] * la
        min_in_row = curr[0]
        for i, ca in enumerate(a, 1):
            curr[i] = min(
                prev[i] + 1,       # deletion
                curr[i - 1] + 1,   # insertion
                prev[i - 1] + (0 if ca == cb else 1),  # substitution
            )
            if curr[i] < min_in_row:
                min_in_row = curr[i]
        if min_in_row > max_dist:
            return max_dist + 1
        prev = curr
    return prev[la]


def bucket_by_first_char(names: Iterable[str]) -> dict[str, list[str]]:
    """Group strings by first character (post-normalization). Strings with
    edit distance ≤ 1 from each other almost always share a first char
    when both are length ≥ 3; for very short strings we accept some
    over-bucketing rather than miss matches."""
    out: dict[str, list[str]] = defaultdict(list)
    for n in names:
        if not n:
            continue
        out[n[0]].append(n)
    return dict(out)


def fuzzy_lookup(
    needle: str,
    index: dict[str, str],
    max_dist: int = 2,
    buckets: dict[str, list[str]] | None = None,
) -> tuple[str, int] | None:
    """Find the best fuzzy hit in `index` (mapping normalized_name → condo_id).
    Returns (matched_normalized_name, distance) or None.

    Pass `buckets` if you're calling this in a loop over many needles —
    bucketing once is much cheaper than once per needle.
    """
    if not needle or not index:
        return None
    if buckets is None:
        buckets = bucket_by_first_char(index.keys())
    candidates = buckets.get(needle[0], [])
    if not candidates:
        return None
    best: tuple[str, int] | None = None
    for cand in candidates:
        if cand == needle:
            return (cand, 0)
        d = levenshtein(needle, cand, max_dist=max_dist)
        if d <= max_dist and (best is None or d < best[1]):
            best = (cand, d)
            if d == 1:
                # 1-char diff is rare enough that we can short-circuit
                # without losing accuracy in practice
                break
    return best
