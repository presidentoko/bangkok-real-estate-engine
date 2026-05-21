"""Backfill lat/lng on FazWaz + DDProperty condos by visiting each listing's
detail page once.

Both sites are Cloudflare-guarded — uses the same persistent nodriver profile
as the existing ingest scripts. Polite delay between fetches.

Extraction patterns (verified by scripts/probe_latlng_detail.py 2026-05-21):
  - FazWaz:    Google Maps Street View URL `viewpoint=LAT,LNG` in detail HTML.
  - DDProperty: First `"latitude": LAT` / `"longitude": LNG` JSON field in HTML.

Updates condos.latitude / condos.longitude only when both parse cleanly and
look like Thai coordinates (lat 5–21, lng 97–106).

Usage:
  python scripts/enrich_latlng.py --source fazwaz                # full sweep
  python scripts/enrich_latlng.py --source ddproperty --limit 50
  python scripts/enrich_latlng.py --source fazwaz --delay-s 6 --dry-run
"""
from __future__ import annotations
import argparse
import asyncio
import io
import os
import re
import sys
import time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

from src.db import get_client  # noqa: E402
from src.scrapers.hipflat import _unwrap  # noqa: E402


SOURCE_CONFIG = {
    "fazwaz": {
        "profile": ".nodriver-profile-fazwaz",
        "extract": "fazwaz_viewpoint",
    },
    "ddproperty": {
        "profile": ".nodriver-profile-ddproperty",
        "extract": "ddproperty_json",
    },
}

# FazWaz: Google Maps Street View URL embeds the building coord.
FAZWAZ_RE = re.compile(
    r"google\.com/maps/@\?api=1[^\"'\s<>]*?viewpoint=(-?\d+\.\d+),(-?\d+\.\d+)",
    re.IGNORECASE,
)

# DDProperty: first explicit latitude/longitude JSON pair.
DD_LAT_RE = re.compile(r'"latitude"\s*:\s*(-?\d+\.\d+)')
DD_LNG_RE = re.compile(r'"longitude"\s*:\s*(-?\d+\.\d+)')


def _is_thai_coord(lat: float, lng: float) -> bool:
    return 5.0 <= lat <= 21.0 and 97.0 <= lng <= 106.0


def extract_latlng(html: str, mode: str) -> tuple[float, float] | None:
    if mode == "fazwaz_viewpoint":
        m = FAZWAZ_RE.search(html)
        if not m:
            return None
        try:
            lat, lng = float(m.group(1)), float(m.group(2))
        except ValueError:
            return None
        return (lat, lng) if _is_thai_coord(lat, lng) else None

    if mode == "ddproperty_json":
        lat_m = DD_LAT_RE.search(html)
        lng_m = DD_LNG_RE.search(html)
        if not (lat_m and lng_m):
            return None
        try:
            lat, lng = float(lat_m.group(1)), float(lng_m.group(1))
        except ValueError:
            return None
        return (lat, lng) if _is_thai_coord(lat, lng) else None

    raise ValueError(f"unknown extract mode: {mode}")


def _candidates(client, source: str, limit: int | None) -> list[dict]:
    """Condos of the given source that are missing lat/lng and have a URL.
    Paginates explicitly — PostgREST single-response cap is 1000 rows."""
    out: list[dict] = []
    offset = 0
    page_size = 1000
    while True:
        if limit is not None and len(out) >= limit:
            return out[:limit]
        this_page = page_size
        if limit is not None:
            this_page = min(page_size, limit - len(out))
        batch = (
            client.table("condos")
            .select("id, name, url")
            .eq("source", source)
            .not_.is_("url", "null")
            .is_("latitude", "null")
            .eq("is_active", True)
            .order("last_seen_at", desc=True)
            .range(offset, offset + this_page - 1)
            .execute()
            .data
        ) or []
        out.extend(batch)
        if len(batch) < this_page:
            return out
        offset += this_page


async def _fetch_html(browser, url: str) -> str | None:
    try:
        tab = await asyncio.wait_for(browser.get(url), timeout=60)
        try:
            await asyncio.wait_for(tab.verify_cf(), timeout=180)
        except Exception as e:
            logger.debug(f"verify_cf: {e}")
        await asyncio.sleep(6.0)
        html = _unwrap(await asyncio.wait_for(
            tab.evaluate("document.documentElement.outerHTML"),
            timeout=20,
        ))
        if not isinstance(html, str) or len(html) < 1000:
            logger.warning(
                f"  evaluate returned {type(html).__name__} "
                f"(len={len(html) if hasattr(html, '__len__') else '?'}) — treating as fail"
            )
            return None
        return html
    except Exception as e:
        logger.warning(f"  fetch failed: {type(e).__name__}: {e}")
        return None


async def run(source: str, limit: int | None, delay_s: float, dry_run: bool) -> int:
    cfg = SOURCE_CONFIG[source]
    client = get_client()
    cands = _candidates(client, source, limit)
    logger.info(f"lat/lng enrich [{source}]: {len(cands)} condos missing coords")
    if not cands:
        return 0

    profile_dir = os.path.join(ROOT, cfg["profile"])
    os.makedirs(profile_dir, exist_ok=True)
    browser = await uc.start(headless=False, user_data_dir=profile_dir, sandbox=True)

    written = 0
    no_match = 0
    failed = 0
    started = time.time()
    try:
        for i, cd in enumerate(cands, 1):
            url = cd["url"]
            html = await _fetch_html(browser, url)
            if not html:
                failed += 1
                await asyncio.sleep(delay_s)
                continue
            res = extract_latlng(html, cfg["extract"])
            if not res:
                no_match += 1
                logger.warning(
                    f"  [{i}/{len(cands)}] '{cd['name'][:40]}' → no lat/lng pattern"
                )
                await asyncio.sleep(delay_s)
                continue
            lat, lng = res
            logger.info(
                f"  [{i}/{len(cands)}] '{cd['name'][:40]}' → {lat:.6f}, {lng:.6f}"
            )
            if not dry_run:
                client.table("condos").update({
                    "latitude": lat,
                    "longitude": lng,
                }).eq("id", cd["id"]).execute()
                written += 1
            await asyncio.sleep(delay_s)
    finally:
        try:
            browser.stop()
        except Exception:
            pass

    elapsed_min = (time.time() - started) / 60
    logger.info(
        f"Done [{source}]. written={written} no_match={no_match} failed={failed} "
        f"elapsed={elapsed_min:.1f}min"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, choices=sorted(SOURCE_CONFIG))
    ap.add_argument("--limit", type=int, default=None,
                    help="Cap rows touched this run (default: all candidates)")
    ap.add_argument("--delay-s", type=float, default=6.0,
                    help="Sleep between detail pages (default 6.0 — stay polite)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print extractions, do not write")
    args = ap.parse_args()

    return asyncio.run(run(args.source, args.limit, args.delay_s, args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
