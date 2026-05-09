"""hipflat.co.th building scraper — Phase 1 (inventory).

nodriver-based: playwright + manual stealth tricks failed against Cloudflare's
fingerprint detection (verified 2026-05-05). nodriver controls Chrome via raw
CDP without the automation tells playwright bakes in, and ships
`tab.verify_cf()` for the soft challenge case.

Tier layout
  L1  /en/thailand-projects/condo/{region_root}                master sub-area directory
  L2  /en/thailand-projects/condo/{region_root}/{subarea}-{xx} ~30 buildings/sub-area
  L3  /en/projects/{slug}-{6char-hash}                         unit listings + meta

`region_root` is the hipflat province slug (`bangkok-bm`, `chonburi-cb` for
Pattaya, `prachuap-khiri-khan-pk` for Hua Hin). Each yielded building carries
the canonical province key so the persister can tag the row.

Phase 1 walks L1 → L2 and yields one item per *building*.
Phase 2 (future) walks L3 to enrich each building with units + price history.
"""
from __future__ import annotations

import asyncio
import os
import re
from typing import AsyncIterator
from urllib.parse import urlparse

import nodriver as uc
from loguru import logger

BASE_URL = "https://www.hipflat.co.th"
PROJECT_PAGE_PREFIX = "/en/projects/"

# Property types we know how to seed. hipflat uses the slug below in the
# directory URL (`/en/thailand-projects/<slug>/<region_root>`). All types share
# the L3 page format (`/en/projects/{slug}-{hash}`), so the L3 parser is
# property-type-agnostic.
SUPPORTED_PROPERTY_TYPES = ("condo", "apartment", "serviced-apartment")

# Canonical province key → hipflat region_root slug. Verified 2026-05-07 via
# scripts/probe_region_root.py (lists every province slug from the master condo
# directory). Pattaya is a subset of Chonburi province; running both seeds
# (chonburi first, pattaya second) tags Pattaya-city buildings as 'pattaya' and
# the rest of Chonburi (Sriracha, Bang Saen, etc.) as 'chonburi'.
REGION_ROOTS: dict[str, str] = {
    "bangkok": "bangkok-bm",
    "pattaya": "pattaya-ty",
    "chonburi": "chonburi-cb",
    "huahin": "prachuap-khiri-khan-pk",
    "phuket": "phuket-pu",
    "chiangmai": "chiang-mai-cm",
}
DEFAULT_REGION = "bangkok"


def _khet_directory_url(property_type: str, region_root: str) -> str:
    return f"{BASE_URL}/en/thailand-projects/{property_type}/{region_root}"


def _khet_page_prefix(property_type: str, region_root: str) -> str:
    return f"/en/thailand-projects/{property_type}/{region_root}/"

# /en/projects/paragon-31-ukvsxa  →  hash "ukvsxa" is the stable building id
_PROJECT_HASH_RE = re.compile(r"-([a-z0-9]{6})$")

PROFILE_DIR = os.path.join(os.getcwd(), ".nodriver-profile")
PER_PAGE_DELAY_S = 5
POST_NAV_PAUSE_S = 2


def _project_id_from_url(url: str) -> str | None:
    path = urlparse(url).path
    if not path.startswith(PROJECT_PAGE_PREFIX):
        return None
    slug = path[len(PROJECT_PAGE_PREFIX):].rstrip("/")
    m = _PROJECT_HASH_RE.search(slug)
    return m.group(1) if m else None


def _khet_slug_from_url(url: str, prefix: str) -> str | None:
    """`.../bangkok-bm/watthana-wa` → `watthana` (drop the 2-3 char khet code)."""
    path = urlparse(url).path
    if prefix not in path:
        return None
    tail = path.split(prefix, 1)[1].rstrip("/")
    parts = tail.rsplit("-", 1)
    if len(parts) == 2 and len(parts[1]) <= 3:
        return parts[0]
    return tail


def _absolutize(href: str) -> str:
    return href if href.startswith("http") else BASE_URL + href


def _build_extract_js(prefix: str) -> str:
    # prefix is hardcoded in this module; no quoting risk.
    return f"""
    (() => {{
      const out = [];
      const seen = new Set();
      for (const a of document.querySelectorAll('a[href]')) {{
        const href = a.getAttribute('href');
        if (!href || !href.includes({prefix!r})) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        out.push([href, a.getAttribute('title') || '']);
      }}
      return out;
    }})()
    """


def _unwrap(val):
    """nodriver's evaluate returns CDP RemoteObject-shaped values:
        scalar  -> {'type': 'string|number|boolean', 'value': ...}
        array   -> {'type': 'array', 'value': [<wrapped item>, ...]}
        object  -> {'type': 'object', 'value': {...}}
    Recursively peel the wrappers off so callers see plain Python values.
    """
    if isinstance(val, dict) and "type" in val and "value" in val:
        return _unwrap(val["value"])
    if isinstance(val, list):
        return [_unwrap(item) for item in val]
    return val


async def _extract_links(tab, prefix: str) -> list[tuple[str, str]]:
    raw = await tab.evaluate(_build_extract_js(prefix))
    return _unwrap(raw) or []


async def _open_with_cf(tab, url: str, label: str) -> bool:
    """Navigate, let nodriver auto-handle a Cloudflare challenge if present."""
    try:
        await tab.get(url)
    except Exception as e:
        logger.warning(f"[hipflat] {label} goto failed: {e}")
        return False
    try:
        await tab.verify_cf()  # nodriver clicks the Turnstile checkbox itself
    except Exception as e:
        logger.warning(f"[hipflat] {label} verify_cf raised (continuing): {e}")
    try:
        await tab.sleep(POST_NAV_PAUSE_S)
    except Exception:
        await asyncio.sleep(POST_NAV_PAUSE_S)
    return True


async def scrape(
    max_listings: int,
    property_type: str = "condo",
    region: str = DEFAULT_REGION,
) -> AsyncIterator[dict]:
    """Yield one inventory item per building (Phase 1).

    property_type × region picks which hipflat directory we walk, e.g.
      condo + bangkok  → /en/thailand-projects/condo/bangkok-bm
      condo + pattaya  → /en/thailand-projects/condo/chonburi-cb
      condo + huahin   → /en/thailand-projects/condo/prachuap-khiri-khan-pk

    Each yielded dict carries `property_type` and `province` so the persister
    can tag the row.
    """
    if property_type not in SUPPORTED_PROPERTY_TYPES:
        raise ValueError(
            f"unsupported property_type {property_type!r} "
            f"(supported: {SUPPORTED_PROPERTY_TYPES})"
        )
    if region not in REGION_ROOTS:
        raise ValueError(
            f"unsupported region {region!r} (supported: {tuple(REGION_ROOTS)})"
        )
    region_root = REGION_ROOTS[region]
    khet_dir = _khet_directory_url(property_type, region_root)
    khet_prefix = _khet_page_prefix(property_type, region_root)

    yielded = 0
    os.makedirs(PROFILE_DIR, exist_ok=True)

    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_DIR,
        browser_args=["--lang=en-US"],
    )
    try:
        logger.info(f"[hipflat] L1 GET ({property_type}): {khet_dir}")
        tab = await browser.get(khet_dir)
        try:
            await tab.verify_cf()
        except Exception as e:
            logger.warning(f"[hipflat] L1 verify_cf: {e}")
        try:
            await tab.sleep(3)
        except Exception:
            await asyncio.sleep(3)

        raw_khet = await _extract_links(tab, khet_prefix)
        khet_urls: list[str] = []
        seen_khet: set[str] = set()
        for href, _title in raw_khet:
            url = _absolutize(href)
            path = urlparse(url).path
            if path.rstrip("/").endswith(f"/{region_root}"):
                continue
            if khet_prefix not in path:
                continue
            tail = path.split(khet_prefix, 1)[1].rstrip("/")
            if not tail or "/" in tail:
                continue
            if url in seen_khet:
                continue
            seen_khet.add(url)
            khet_urls.append(url)
        logger.info(f"[hipflat] L1: {len(khet_urls)} khet pages")
        if not khet_urls:
            try:
                title = _unwrap(await tab.evaluate("document.title"))
                logger.warning(f"[hipflat] L1 empty — title={title!r}")
            except Exception:
                pass
            return

        seen_buildings: set[str] = set()
        for khet_url in khet_urls:
            if yielded >= max_listings:
                break
            khet = _khet_slug_from_url(khet_url, khet_prefix) or "?"
            logger.info(f"[hipflat] L2 GET ({khet}): {khet_url}")
            if not await _open_with_cf(tab, khet_url, f"L2 {khet}"):
                continue

            raw_projects = await _extract_links(tab, PROJECT_PAGE_PREFIX)
            if not raw_projects:
                try:
                    title = _unwrap(await tab.evaluate("document.title"))
                    body_len = _unwrap(await tab.evaluate(
                        "(document.body && document.body.textContent || '').length"
                    ))
                    logger.warning(
                        f"[hipflat] L2 {khet} empty — title={title!r} body={body_len}"
                    )
                except Exception:
                    pass

            new_in_khet = 0
            for href, title in raw_projects:
                if yielded >= max_listings:
                    break
                url = _absolutize(href)
                pid = _project_id_from_url(url)
                if not pid or pid in seen_buildings:
                    continue
                name = (title or "").strip()
                if not name:
                    continue
                seen_buildings.add(pid)
                yield {
                    "source": "hipflat",
                    "source_listing_id": pid,
                    "name": name,
                    "region": khet,
                    "province": region,
                    "url": url,
                    "property_type": property_type,
                }
                yielded += 1
                new_in_khet += 1
            logger.info(
                f"[hipflat] L2 {khet}: +{new_in_khet} buildings (total: {yielded})"
            )
            await asyncio.sleep(PER_PAGE_DELAY_S)
    finally:
        try:
            browser.stop()
        except Exception as e:
            logger.warning(f"[hipflat] browser.stop() raised: {e}")

    logger.info(f"[hipflat] Phase 1 done — {yielded} buildings")
