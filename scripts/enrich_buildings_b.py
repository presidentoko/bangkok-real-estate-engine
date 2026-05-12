"""Phase 2 Tier B — full enrichment of every hipflat building with units +
chart + market summary + neighbours.

Mirrors enrich_buildings.py but uses the Tier B parser & persister.
Resumable via tier_b_fetched_at column.

Usage
-----
  python scripts/enrich_buildings_b.py
  python scripts/enrich_buildings_b.py --limit 25
  python scripts/enrich_buildings_b.py --force
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import nodriver as uc  # noqa: E402
from loguru import logger  # noqa: E402

# In CI: nodriver spawns chrome with stdout/stderr=PIPE and never drains
# them. On Ubuntu 24.04 chrome floods stderr with dbus + GPU warnings
# during startup; the 64KB pipe buffer fills, chrome blocks on the write,
# and CDP init deadlocks — surfacing as "Failed to connect to browser"
# ~3s in. Patching create_subprocess_exec to let stdio inherit our fds
# instead of being PIPE'd makes chrome write to the workflow log freely
# and the deadlock disappears.
if os.environ.get("CI"):
    import asyncio as _aio
    _orig_spawn = _aio.create_subprocess_exec
    async def _spawn_inheriting_stdio(*args, **kwargs):
        kwargs.pop("stdout", None)
        kwargs.pop("stderr", None)
        return await _orig_spawn(*args, **kwargs)
    _aio.create_subprocess_exec = _spawn_inheriting_stdio

from src.db import get_client, persist_detail_b  # noqa: E402
from src.scrapers.hipflat_detail import fetch_detail  # noqa: E402
from src.scrapers.hipflat_detail_b import parse_detail_html_b  # noqa: E402

PROFILE_DIR = os.path.join(os.getcwd(), ".nodriver-profile")
DEFAULT_DELAY_S = 5
MAX_DELAY_S = 60
RESET_AFTER_SUCCESSES = 5
SKIP_IF_FETCHED_WITHIN_DAYS = 14

# Per-step nodriver timeouts. Without these, a hard Cloudflare challenge or
# unresponsive page can leave verify_cf()/evaluate() awaiting forever (this
# silently hung Tier B for 1.5h on 2026-05-07).
GOTO_TIMEOUT_S = 60
VERIFY_CF_TIMEOUT_S = 30
EVALUATE_TIMEOUT_S = 15


def _load_targets(force: bool) -> list[dict]:
    """Page through hipflat condos that have geo (Tier A done) and need Tier B."""
    c = get_client()
    PAGE = 1000
    rows: list[dict] = []
    offset = 0
    while True:
        q = (
            c.table("condos")
            .select("id,name,url,latitude,tier_b_fetched_at")
            .eq("source", "hipflat")
        )
        if not force:
            # Tier A pre-req: only enrich buildings that already have geo.
            q = q.not_.is_("latitude", "null")
        chunk = q.range(offset, offset + PAGE - 1).execute().data or []
        rows.extend(chunk)
        if len(chunk) < PAGE:
            break
        offset += PAGE
    if force:
        return [r for r in rows if r.get("url")]
    cutoff = datetime.now(timezone.utc) - timedelta(days=SKIP_IF_FETCHED_WITHIN_DAYS)
    out = []
    for r in rows:
        if not r.get("url"):
            continue
        fetched = r.get("tier_b_fetched_at")
        if fetched:
            try:
                t = datetime.fromisoformat(fetched.replace("Z", "+00:00"))
                if t > cutoff:
                    continue
            except Exception:
                pass
        out.append(r)
    return out


async def _fetch_html(url: str, browser, label: str) -> str | None:
    """Same nodriver flow as fetch_detail but returns raw HTML so the Tier B
    parser can use it directly. Saves a redundant Tier A parse pass.

    Each nodriver await is bounded by an asyncio.wait_for() so a single hung
    page can never stall the whole pipeline.
    """
    import asyncio as aio
    try:
        tab = await aio.wait_for(browser.get(url), timeout=GOTO_TIMEOUT_S)
    except aio.TimeoutError:
        logger.warning(f"[tier_b] {label} goto timed out after {GOTO_TIMEOUT_S}s")
        return None
    except Exception as e:
        logger.warning(f"[tier_b] {label} goto failed: {e}")
        return None
    try:
        await aio.wait_for(tab.verify_cf(), timeout=VERIFY_CF_TIMEOUT_S)
    except aio.TimeoutError:
        logger.warning(f"[tier_b] {label} verify_cf timed out after {VERIFY_CF_TIMEOUT_S}s — skipping")
        return None
    except Exception as e:
        logger.debug(f"[tier_b] {label} verify_cf: {e}")
    try:
        await tab.sleep(2.0)
    except Exception:
        await aio.sleep(2.0)
    try:
        from src.scrapers.hipflat import _unwrap
        html = _unwrap(
            await aio.wait_for(
                tab.evaluate("document.documentElement.outerHTML"),
                timeout=EVALUATE_TIMEOUT_S,
            )
        )
    except aio.TimeoutError:
        logger.warning(f"[tier_b] {label} outerHTML timed out after {EVALUATE_TIMEOUT_S}s")
        return None
    except Exception as e:
        logger.warning(f"[tier_b] {label} outerHTML failed: {e}")
        return None
    if not isinstance(html, str) or len(html) < 1000:
        logger.warning(f"[tier_b] {label} HTML suspiciously small")
        return None
    return html


DUMP_DIR = Path(os.getcwd()) / "tier_b_dumps"
DUMP_CAP = 3  # only keep the first few — the rest are noise once we know the cause


def _dump_failed_html(row: dict, html: str | None, label: str, fail_idx: int) -> None:
    if not html:
        return
    # Inline fingerprint first — cheap and always useful in logs.
    head = html[:4096].lower()
    markers = []
    if "just a moment" in head:
        markers.append("CF:just-a-moment")
    if "challenge-platform" in head or "/cdn-cgi/challenge-platform" in head:
        markers.append("CF:challenge-platform")
    if "attention required" in head:
        markers.append("CF:attention-required")
    if "cf-mitigated" in head or "cf-ray" in head:
        markers.append("CF:cf-marker")
    if "cloudflare" in head and not markers:
        markers.append("CF:generic")
    import re as _re
    m = _re.search(r"<title[^>]*>([^<]{0,200})</title>", html, _re.I)
    title = (m.group(1).strip() if m else "")[:120]
    logger.warning(
        f"{label} dump: len={len(html)} title={title!r} markers={markers or 'none'}"
    )
    if fail_idx > DUMP_CAP:
        return
    try:
        DUMP_DIR.mkdir(parents=True, exist_ok=True)
        slug = (row.get("url") or "").rsplit("/", 1)[-1] or row.get("id", "unknown")
        (DUMP_DIR / f"{fail_idx:02d}-{slug}.html").write_text(html, encoding="utf-8")
    except Exception as e:
        logger.warning(f"  dump write failed: {e}")


async def _run(limit: int | None, force: bool) -> int:
    targets = _load_targets(force)
    if limit:
        targets = targets[:limit]
    if not targets:
        logger.info("nothing to enrich (Tier B already fresh on all geo-located buildings)")
        return 0
    logger.info(f"Tier B enriching {len(targets)} buildings (force={force}, limit={limit})")

    os.makedirs(PROFILE_DIR, exist_ok=True)
    browser_args = ["--lang=en-US"]
    # GH Actions runs in a container-like env: small /dev/shm, setuid
    # sandbox can't initialize. sandbox=False is nodriver's idiomatic
    # switch (also adds --disable-setuid-sandbox).
    sandbox = not os.environ.get("CI")
    # On Ubuntu 24.04 nodriver's candidate scan happily picks
    # /bin/chromium — but that path is a snap transitional shim that
    # never launches. We must point it at our google-chrome-stable
    # symlink explicitly or it will pick the broken one and hang on
    # "Failed to connect to browser".
    exe = "/usr/local/bin/chrome" if os.environ.get("CI") else None
    if os.environ.get("CI"):
        browser_args.append("--disable-dev-shm-usage")
    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_DIR,
        browser_args=browser_args,
        sandbox=sandbox,
        browser_executable_path=exe,
    )
    client = get_client()

    delay = DEFAULT_DELAY_S
    consecutive_ok = 0
    n_ok = n_fail = 0
    totals = {"facilities": 0, "parking_facts": 0, "neighbours": 0,
              "chart_rows": 0, "listings": 0}
    started = time.time()

    try:
        for i, row in enumerate(targets, 1):
            label = f"[{i}/{len(targets)}] {row['name'][:40]}"
            html = await _fetch_html(row["url"], browser, label)
            if html is None:
                n_fail += 1
                consecutive_ok = 0
                delay = min(MAX_DELAY_S, delay * 2)
                logger.warning(f"{label} FAIL  (delay → {delay}s)")
                await asyncio.sleep(delay)
                continue

            try:
                parsed = parse_detail_html_b(html, url=row["url"])
                counts = persist_detail_b(client, row["id"], parsed)
            except Exception as e:
                n_fail += 1
                logger.error(f"{label} parse/persist failed: {e}")
                # Diagnostic: dump first few failing HTMLs + log a fingerprint
                # so we can tell at a glance whether GH Actions is getting a
                # Cloudflare interstitial vs something else entirely.
                _dump_failed_html(row, html, label, n_fail)
            else:
                n_ok += 1
                consecutive_ok += 1
                for k, v in counts.items():
                    totals[k] += v
                if consecutive_ok >= RESET_AFTER_SUCCESSES and delay > DEFAULT_DELAY_S:
                    old = delay
                    delay = max(DEFAULT_DELAY_S, delay // 2)
                    logger.info(f"  cooled down: {old}s → {delay}s")

            if i % 25 == 0 or i == len(targets):
                elapsed = time.time() - started
                rate = i / max(elapsed, 1)
                eta = (len(targets) - i) / max(rate, 0.001)
                logger.info(
                    f"progress {i}/{len(targets)}  ok={n_ok} fail={n_fail}  "
                    f"rate={rate:.2f}/s  eta={eta/60:.1f}min  delay={delay}s  "
                    f"totals={totals}"
                )
            await asyncio.sleep(delay)
    finally:
        try:
            browser.stop()
        except Exception as e:
            logger.warning(f"browser.stop raised: {e}")

    elapsed = time.time() - started
    logger.info(
        f"DONE in {elapsed/60:.1f} min — ok={n_ok} fail={n_fail}  totals={totals}"
    )

    # Refresh per-condo DOM aggregates so the site can sort/filter without a
    # request-time GROUP BY across the listings table.
    try:
        client.rpc("recompute_condo_dom").execute()
        logger.info("condo DOM aggregates recomputed")
    except Exception as e:
        logger.warning(f"recompute_condo_dom RPC raised: {e}")
    return 0 if n_fail == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    return uc.loop().run_until_complete(_run(args.limit, args.force))


if __name__ == "__main__":
    raise SystemExit(main())
