"""Unattended ~N-hour NEW-LISTING discovery loop to enrich the site.

Repeats discovery passes until a --hours budget is exhausted, then stops mid-
pass at the next step boundary. Each pass:

  1. DotProperty Thailand-wide sweep   (fully unattended — plain HTTP scraper)
  2. FazWaz sweep, 5 main cities       (nodriver; reuses CF profile cookies)
  3. lat/lng backfill: fazwaz + ddproperty   (nodriver; fills missing coords)
  4. post-processing (always, even if a scraper failed):
       backfill_province → compute_value_scores → compute_yields
       → compute_super_value → populate_risk_factors

Why this exists / how it differs from the reviews loop
------------------------------------------------------
Discovery uses nodriver (a real headful browser) and plain HTTP, all over the
machine's DIRECT IP. It does NOT use the SOCKS proxy pool (2080-2087) that the
Google-reviews loop depends on, so it can run even when those 8 NordVPN slots
are saturated by other projects. Steps run strictly SERIALLY so at most one
nodriver Chrome is alive at a time — keeps the 16GB laptop off the OOM edge.

DDProperty is OFF by default: it needs a one-time Cloudflare Turnstile click
that may not survive unattended. Enable with --with-dd once its profile is warm.

Usage:
  python scripts/overnight_discovery.py --hours 20
  python scripts/overnight_discovery.py --hours 20 --with-dd
  python scripts/overnight_discovery.py --hours 8 --skip fazwaz
  python scripts/overnight_discovery.py --hours 1 --dry-run    # plan only
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PYTHON = sys.executable


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def run_step(label: str, cmd: list[str], deadline: float, dry_run: bool,
             timeout_s: float | None = None) -> int:
    """Run one step unless we're already past the deadline. Returns the step's
    exit code (0 on skip/dry-run), or -1 if skipped for time.

    A per-step `timeout_s` caps how long any single step may run, clamped to the
    remaining budget. A scraper that hangs (stuck connection, DB write with no
    timeout) would otherwise hold the whole loop hostage for the entire --hours
    budget; on timeout we kill the child tree and move on. Caps are sized
    generously so a healthy run is never cut short."""
    remaining = deadline - time.time()
    if remaining <= 0:
        print(f"[{_now()}] BUDGET EXHAUSTED — skipping: {label}", flush=True)
        return -1
    print(f"\n{'='*68}", flush=True)
    print(f"[{_now()}] STEP: {label}", flush=True)
    print(f"  cmd: {' '.join(cmd)}", flush=True)
    print(f"  budget left: {remaining/3600:.2f}h", flush=True)
    if dry_run:
        print("  (dry-run — not executed)", flush=True)
        print(f"{'='*68}", flush=True)
        return 0
    cap = remaining if timeout_s is None else min(timeout_s, remaining)
    print(f"  step timeout: {cap/60:.0f} min", flush=True)
    print(f"{'='*68}", flush=True)
    t0 = time.time()
    # start_new_session so we can kill the whole child tree (sweep scripts spawn
    # ingest subprocesses / nodriver Chrome).
    try:
        proc = subprocess.Popen(cmd, cwd=ROOT, start_new_session=True)
    except Exception as e:
        print(f"[{_now()}] {label}: SPAWN FAILED {type(e).__name__}: {e}", flush=True)
        return 1
    try:
        rc = proc.wait(timeout=cap)
    except subprocess.TimeoutExpired:
        print(f"[{_now()}] {label}: TIMEOUT after {cap/60:.0f} min — killing tree",
              flush=True)
        _kill_tree(proc)
        return 1
    except Exception as e:
        print(f"[{_now()}] {label}: EXCEPTION {type(e).__name__}: {e}", flush=True)
        _kill_tree(proc)
        return 1
    mins = (time.time() - t0) / 60
    print(f"[{_now()}] {label}: {'OK' if rc == 0 else f'FAILED (exit {rc})'} "
          f"in {mins:.1f} min", flush=True)
    return rc


def _kill_tree(proc: subprocess.Popen) -> None:
    """Best-effort kill of a child process and everything it spawned."""
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                           capture_output=True)
        else:
            import signal
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except Exception as e:
        print(f"  [kill] {type(e).__name__}: {e}", flush=True)
    try:
        proc.wait(timeout=30)
    except Exception:
        pass


# FazWaz cities, run as SEPARATE steps. A whole-Thailand FazWaz sweep took
# >4h on Pattaya alone, tripped the step timeout, and the loop re-ran Pattaya
# every pass while Phuket/Chiang Mai/Hua Hin/Bangkok were never reached. One
# step per city (each with its own cap) means a slow/blocked city is killed on
# its own and the rest still run.
FAZWAZ_CITIES = ["pattaya", "phuket", "chiang-mai", "hua-hin", "bangkok"]

# Per-step wall-clock caps (minutes). A hung step gets killed at its cap so the
# loop keeps advancing. Sized so a healthy run never gets cut short.
STEP_TIMEOUT_MIN = {
    "dotproperty": 180,
    "ddproperty": 180,
    "coords-fazwaz": 240,
    "coords-ddproperty": 240,
}
# Each FazWaz city step (sale+rent for one city) gets its own cap.
FAZWAZ_CITY_TIMEOUT_MIN = 150


def discovery_steps(with_dd: bool, skip: set[str]) -> list[tuple[str, str, list[str]]]:
    """(key, label, cmd) tuples for one pass, in order."""
    steps: list[tuple[str, str, list[str]]] = []
    if "dotproperty" not in skip:
        steps.append((
            "dotproperty",
            "DotProperty Thailand-wide sweep",
            [PYTHON, "scripts/sweep_dotproperty_thailand.py"],
        ))
    if "fazwaz" not in skip:
        for city in FAZWAZ_CITIES:
            steps.append((
                f"fazwaz-{city}",
                f"FazWaz sweep — {city} (sale+rent)",
                [PYTHON, "scripts/sweep_fazwaz_thailand.py", "--cities", city],
            ))
    if with_dd and "ddproperty" not in skip:
        steps.append((
            "ddproperty",
            "DDProperty Thailand sweep",
            [PYTHON, "scripts/sweep_ddproperty_thailand.py"],
        ))
    if "coords" not in skip:
        steps.append((
            "coords-fazwaz",
            "lat/lng backfill — fazwaz",
            [PYTHON, "scripts/enrich_latlng.py", "--source", "fazwaz"],
        ))
        steps.append((
            "coords-ddproperty",
            "lat/lng backfill — ddproperty",
            [PYTHON, "scripts/enrich_latlng.py", "--source", "ddproperty"],
        ))
    return steps


def step_timeout_min(key: str) -> int:
    """Per-step wall-clock cap. FazWaz per-city steps share one cap."""
    if key.startswith("fazwaz-"):
        return FAZWAZ_CITY_TIMEOUT_MIN
    return STEP_TIMEOUT_MIN.get(key, 180)


# Post-processing always runs after the scrapers so new rows get scored even
# if a pass ends mid-way. Cheap (DB-only), so we run it whenever a pass touched
# anything, regardless of remaining budget being tight.
POST_STEPS: list[tuple[str, list[str]]] = [
    ("backfill_province (re-tag bangkok-default rows)",
     [PYTHON, "scripts/backfill_province.py"]),
    # Capped OSM livability top-up so newly-discovered non-Bangkok condos get
    # hospitals/transit/walkability (and thus a retiree score) over time. The
    # 30-min POST_STEPS cap kills it mid-batch; it's incremental + resumable so
    # the next pass continues. The initial backlog is cleared by a separate
    # one-off `populate_livability_osm.py --sources fazwaz dotproperty ddproperty`.
    ("populate_livability_osm (non-Bangkok coverage, capped)",
     [PYTHON, "scripts/populate_livability_osm.py", "--limit", "400"]),
    ("compute_value_scores (bubble index)",
     [PYTHON, "scripts/compute_value_scores.py"]),
    ("compute_yields",
     [PYTHON, "scripts/compute_yields.py"]),
    ("compute_super_value",
     [PYTHON, "scripts/compute_super_value.py"]),
    ("populate_risk_factors",
     [PYTHON, "scripts/populate_risk_factors.py"]),
    ("compute_resale_liquidity (can I get my money back out?)",
     [PYTHON, "scripts/compute_resale_liquidity.py"]),
    ("compute_developer_stats (developer report card)",
     [PYTHON, "scripts/compute_developer_stats.py"]),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=20.0,
                    help="Total wall-clock budget. Loop stops at the next step "
                         "boundary once exceeded.")
    ap.add_argument("--with-dd", action="store_true",
                    help="Include DDProperty sweep (needs a warm CF profile).")
    ap.add_argument("--skip", nargs="+", default=[],
                    choices=["dotproperty", "fazwaz", "ddproperty", "coords"],
                    help="Discovery steps to skip.")
    ap.add_argument("--skip-post", action="store_true",
                    help="Skip the post-processing scoring chain.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the plan without executing.")
    args = ap.parse_args()

    skip = set(args.skip)
    start = time.time()
    deadline = start + args.hours * 3600
    eta = datetime.now() + timedelta(hours=args.hours)

    steps = discovery_steps(args.with_dd, skip)
    print(f"[{_now()}] OVERNIGHT DISCOVERY — budget {args.hours}h "
          f"(until ~{eta.strftime('%Y-%m-%d %H:%M')})", flush=True)
    print(f"  discovery steps/pass: {[k for k, _, _ in steps]}", flush=True)
    print(f"  post-processing: {'skipped' if args.skip_post else 'on'}", flush=True)
    print(f"  ddproperty: {'on' if args.with_dd else 'off'}", flush=True)
    if not steps:
        print("  nothing to do (all discovery steps skipped)", flush=True)
        return 1

    pass_n = 0
    while time.time() < deadline:
        pass_n += 1
        print(f"\n{'#'*68}", flush=True)
        print(f"[{_now()}] PASS {pass_n}  (budget left "
              f"{(deadline - time.time())/3600:.2f}h)", flush=True)
        print(f"{'#'*68}", flush=True)

        touched = False
        for key, label, cmd in steps:
            cap_s = step_timeout_min(key) * 60
            rc = run_step(label, cmd, deadline, args.dry_run, timeout_s=cap_s)
            if rc == -1:
                break  # out of time — stop starting new discovery steps
            if rc != 0:
                print(f"[{_now()}] WARNING: '{label}' failed (exit {rc}) — "
                      f"continuing to next step", flush=True)
            touched = True

        if touched and not args.skip_post:
            print(f"\n[{_now()}] --- post-processing (pass {pass_n}) ---", flush=True)
            for label, cmd in POST_STEPS:
                # Post steps are cheap and idempotent; cap each at 30 min so a
                # hung DB call can't freeze the loop.
                if args.dry_run:
                    print(f"  (dry-run) {label}", flush=True)
                else:
                    run_step(label, cmd, time.time() + 3600, args.dry_run,
                             timeout_s=30 * 60)

        if args.dry_run:
            print(f"\n[{_now()}] dry-run: stopping after one planned pass", flush=True)
            break

    print(f"\n{'='*68}", flush=True)
    print(f"[{_now()}] DISCOVERY COMPLETE — {pass_n} pass(es) in "
          f"{(time.time()-start)/3600:.2f}h", flush=True)
    print(f"{'='*68}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# test2
# test3
