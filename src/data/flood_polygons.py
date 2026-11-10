"""Which Bangkok khet a coordinate is in, from the district polygon layer.

Same layer (web/public/bangkok-districts.geojson) and the same rule as the
site's web/lib/floodLayer.server.ts, so the district stored on a condo, the
flood level on its report card and the counts on /flood all agree:

  1. Find the polygon that contains the point.
  2. If the stored district (the one the scraper derived from the listing's
     text) is a different khet but the point lies within BOUNDARY_BUFFER_M of
     that khet's polygon, the point is on the boundary and the text is as
     good a guess as the geometry -- keep the stored district.
  3. Otherwise the polygon wins.
  4. No coordinates, or a point outside every polygon -> the stored district.

Why: the text-derived district is wrong for ~25% of hipflat Bangkok
buildings (a name containing "Lumpini" or "Sathorn" files the building
under Pathum Wan / Sathon wherever it is). Measured 2026-11-10.

Keep BOUNDARY_BUFFER_M in step with the TypeScript constant of the same name.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
GEOJSON = ROOT / "web" / "public" / "bangkok-districts.geojson"

BOUNDARY_BUFFER_M = 75.0

_SLUG_RE = re.compile(r"[\s_\-]+")


def district_slug(name: str | None) -> str | None:
    """'Bang Rak' / 'bang_rak' / 'bang-rak' -> 'bang-rak' (regions.name form)."""
    if not name:
        return None
    return _SLUG_RE.sub("-", name.strip().lower()) or None


def _in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_polygon(x: float, y: float, rings: list) -> bool:
    if not rings or not _in_ring(x, y, rings[0]):
        return False
    return not any(_in_ring(x, y, h) for h in rings[1:])


def _seg_dist_m(px, py, ax, ay, bx, by) -> float:
    # Equirectangular metres around the point -- plenty for ~100 m questions.
    kx = math.cos(math.radians(py)) * 111_320.0
    ky = 110_540.0
    ax, bx, px_ = ax * kx, bx * kx, px * kx
    ay, by, py_ = ay * ky, by * ky, py * ky
    dx, dy = bx - ax, by - ay
    seg = dx * dx + dy * dy
    t = 0.0 if seg == 0 else max(0.0, min(1.0, ((px_ - ax) * dx + (py_ - ay) * dy) / seg))
    return math.hypot(px_ - ax - t * dx, py_ - ay - t * dy)


@lru_cache(maxsize=1)
def _layer() -> dict[str, dict]:
    feats = json.loads(GEOJSON.read_text(encoding="utf-8"))["features"]
    out: dict[str, dict] = {}
    for f in feats:
        slug = district_slug(f["properties"].get("name"))
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        xs = [p[0] for poly in polys for p in poly[0]]
        ys = [p[1] for poly in polys for p in poly[0]]
        out[slug] = {
            "polys": polys,
            "bbox": (min(xs), min(ys), max(xs), max(ys)),
            "level": f["properties"].get("flood_risk_level"),
        }
    if len(out) != 50:
        raise RuntimeError(f"flood layer: expected 50 khet, read {len(out)} from {GEOJSON}")
    return out


def locate(lat: float, lng: float) -> str | None:
    """Slug of the khet polygon containing the point, or None."""
    for slug, d in _layer().items():
        x0, y0, x1, y1 = d["bbox"]
        if not (x0 <= lng <= x1 and y0 <= lat <= y1):
            continue
        if any(_in_polygon(lng, lat, p) for p in d["polys"]):
            return slug
    return None


def distance_to_district_m(slug: str, lat: float, lng: float) -> float | None:
    """Metres from the point to the nearest edge of `slug`'s polygon."""
    d = _layer().get(slug)
    if d is None:
        return None
    best = math.inf
    for poly in d["polys"]:
        for ring in poly:
            for i in range(len(ring)):
                a, b = ring[i - 1], ring[i]
                best = min(best, _seg_dist_m(lng, lat, a[0], a[1], b[0], b[1]))
    return best


def assign_district(lat: float | None, lng: float | None, stored: str | None) -> str | None:
    """The khet a building is counted in (see module docstring for the rule)."""
    stored_slug = district_slug(stored)
    if lat is None or lng is None:
        return stored_slug
    pip = locate(lat, lng)
    if pip is None or pip == stored_slug:
        return stored_slug if pip is None else pip
    if stored_slug in _layer():
        dist = distance_to_district_m(stored_slug, lat, lng)
        if dist is not None and dist <= BOUNDARY_BUFFER_M:
            return stored_slug
    return pip
