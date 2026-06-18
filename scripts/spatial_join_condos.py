"""Find cross-source duplicate condos via lat/lng proximity + name similarity.

Two condos from different sources are flagged as the same building when:
  - Their coordinates are within --radius-m meters of each other (default 60m).
  - Their aggressively-normalized names have SequenceMatcher ratio >= --name-sim
    (default 0.55).

Output is a TSV report; nothing is written to the DB unless --write is passed
later (DB persistence not implemented yet — review the report first).

Usage:
  python scripts/spatial_join_condos.py                   # full run, default thresholds
  python scripts/spatial_join_condos.py --radius-m 50 --name-sim 0.60
  python scripts/spatial_join_condos.py --limit-per-source 200  # quick smoke test
"""
from __future__ import annotations

import argparse
import io
import math
import os
import sys
from collections import defaultdict
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from src.db import _normalize_project_name_aggressive, get_client  # noqa: E402


SOURCES = ("hipflat", "dotproperty", "ddproperty", "fazwaz")
# Bangkok-ish latitude — at 13.7°, 1° lat ≈ 110.9 km, 1° lng ≈ 108.2 km.
# A 60 m bucket → ~0.00054° in either axis. Bucket twice the radius so each
# pair appears in at least one shared cell.
BUCKET_DEG = 0.001  # ≈ 110 m on the lat axis, slightly more on lng


def _fetch_condos(client, limit_per_source: int | None) -> list[dict]:
    """All active condos with lat/lng and a name, across all sources.
    Paginates around the PostgREST 1000-row response cap."""
    out: list[dict] = []
    for src in SOURCES:
        offset = 0
        per_src = 0
        while True:
            page_size = 1000
            if limit_per_source is not None:
                page_size = min(page_size, limit_per_source - per_src)
                if page_size <= 0:
                    break
            batch = (
                client.table("condos")
                .select("id, source, name, latitude, longitude")
                .eq("source", src)
                .eq("is_active", True)
                .not_.is_("latitude", "null")
                .not_.is_("longitude", "null")
                .order("id")
                .range(offset, offset + page_size - 1)
                .execute()
                .data
            ) or []
            out.extend(batch)
            per_src += len(batch)
            if len(batch) < page_size:
                break
            offset += page_size
    return out


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000.0  # earth radius in metres
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = (
        math.sin(dp / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _bucket_key(lat: float, lng: float) -> tuple[int, int]:
    return (int(lat / BUCKET_DEG), int(lng / BUCKET_DEG))


def _neighbour_keys(key: tuple[int, int]):
    bx, by = key
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            yield (bx + dx, by + dy)


def find_matches(rows: list[dict], radius_m: float, name_sim: float):
    """Return list of (a, b, distance_m, name_score) where a, b are dicts.
    Each cross-source pair is reported at most once (a.source < b.source by
    name, or a.id < b.id when sources match — but we skip same-source pairs
    here)."""
    buckets: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for r in rows:
        r["_norm"] = _normalize_project_name_aggressive(r.get("name"))
        if not r["_norm"]:
            continue
        buckets[_bucket_key(r["latitude"], r["longitude"])].append(r)

    seen: set[tuple[int, int]] = set()
    matches: list[tuple[dict, dict, float, float]] = []
    for key, cell in buckets.items():
        for a in cell:
            for nk in _neighbour_keys(key):
                for b in buckets.get(nk, ()):
                    if a["id"] >= b["id"]:
                        continue
                    if a["source"] == b["source"]:
                        continue
                    pair = (a["id"], b["id"])
                    if pair in seen:
                        continue
                    seen.add(pair)
                    dist = _haversine_m(
                        a["latitude"], a["longitude"],
                        b["latitude"], b["longitude"],
                    )
                    if dist > radius_m:
                        continue
                    score = SequenceMatcher(None, a["_norm"], b["_norm"]).ratio()
                    if score < name_sim:
                        continue
                    matches.append((a, b, dist, score))
    matches.sort(key=lambda m: (-m[3], m[2]))
    return matches


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--radius-m", type=float, default=60.0,
                    help="Max distance to consider a match (default 60m)")
    ap.add_argument("--name-sim", type=float, default=0.70,
                    help="Min difflib ratio on normalized names (default 0.70 — "
                         "below 0.65 we start seeing false positives from "
                         "same-soi-different-building neighbours)")
    ap.add_argument("--limit-per-source", type=int, default=None,
                    help="Cap rows per source (smoke testing)")
    ap.add_argument("--out", default="spatial_matches.tsv",
                    help="Output TSV path (default spatial_matches.tsv)")
    args = ap.parse_args()

    client = get_client()
    print(f"loading condos from {len(SOURCES)} sources…", flush=True)
    rows = _fetch_condos(client, args.limit_per_source)
    print(f"  {len(rows):,} condos with lat/lng + name", flush=True)
    by_src: dict[str, int] = defaultdict(int)
    for r in rows:
        by_src[r["source"]] += 1
    for s in SOURCES:
        print(f"    {s:<12} {by_src[s]:>6,}", flush=True)

    print(
        f"matching with radius={args.radius_m}m  name-sim>={args.name_sim} …",
        flush=True,
    )
    matches = find_matches(rows, args.radius_m, args.name_sim)
    print(f"  {len(matches):,} cross-source pairs", flush=True)

    pair_src: dict[tuple[str, str], int] = defaultdict(int)
    for a, b, _d, _s in matches:
        key = tuple(sorted((a["source"], b["source"])))
        pair_src[key] += 1
    for k, v in sorted(pair_src.items(), key=lambda kv: -kv[1]):
        print(f"    {k[0]:<12} × {k[1]:<12} {v:>5,}", flush=True)

    out_path = os.path.join(ROOT, args.out)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(
            "id_a\tsource_a\tname_a\tid_b\tsource_b\tname_b\tdistance_m\tname_score\n"
        )
        for a, b, dist, score in matches:
            f.write(
                f"{a['id']}\t{a['source']}\t{a['name']}\t"
                f"{b['id']}\t{b['source']}\t{b['name']}\t"
                f"{dist:.1f}\t{score:.3f}\n"
            )
    print(f"wrote {out_path}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
