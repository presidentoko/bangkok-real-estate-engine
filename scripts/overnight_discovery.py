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


def run_step(label: str, cmd: list[str], deadline: float, dry_run: bool) -> int:
    """Run one step unless we're already past the deadline. Returns the step's
    exit code (0 on skip/dry-run), or -1 if skipped for time."""
    remaining = deadline - time.time()
    if remaining <= 0:
        print(f"[{_now()}] BUDGET EXHAUSTED — skipping: {label}", flush=True)
        return -1
    print(f"\n{'='*68}", flush=True)
    print(f"[{_now()}] STEP: {label}", flush=True)
    print(f"  cmd: {' '.join(cmd)}", flush=True)
    print(f"  budget left: {remaining/3600:.2f}h", flush=True)
    print(f"{'='*68}", flush=True)
    if dry_run:
        print("  (dry-run — not executed)", flush=True)
        return 0
    t0 = time.time()
    try:
        rc = subprocess.run(cmd, cwd=ROOT).returncode
    except Exception as e:  # never let one step kill the loop
        print(f"[{_now()}] {label}: EXCEPTION {type(e).__name__}: {e}", flush=True)
        return 1
    mins = (time.time() - t0) / 60
    print(f"[{_now()}] {label}: {'OK' if rc == 0 else f'FAILED (exit {rc})'} "
          f"in {mins:.1f} min", flush=True)
    return rc


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
        steps.append((
            "fazwaz",
            "FazWaz sweep (5 main cities, sale+rent)",
            [PYTHON, "scripts/sweep_fazwaz_thailand.py"],
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


# Post-processing always runs after the scrapers so new rows get scored even
# if a pass ends mid-way. Cheap (DB-only), so we run it whenever a pass touched
# anything, regardless of remaining budget being tight.
POST_STEPS: list[tuple[str, list[str]]] = [
    ("backfill_province (re-tag bangkok-default rows)",
     [PYTHON, "scripts/backfill_province.py"]),
    ("compute_value_scores (bubble index)",
     [PYTHON, "scripts/compute_value_scores.py"]),
    ("compute_yields",
     [PYTHON, "scripts/compute_yields.py"]),
    ("compute_super_value",
     [PYTHON, "scripts/compute_super_value.py"]),
    ("populate_risk_factors",
     [PYTHON, "scripts/populate_risk_factors.py"]),
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
        for _key, label, cmd in steps:
            rc = run_step(label, cmd, deadline, args.dry_run)
            if rc == -1:
                break  # out of time — stop starting new discovery steps
            touched = True

        if touched and not args.skip_post:
            print(f"\n[{_now()}] --- post-processing (pass {pass_n}) ---", flush=True)
            for label, cmd in POST_STEPS:
                # Post steps are cheap and idempotent; run regardless of budget.
                if args.dry_run:
                    print(f"  (dry-run) {label}", flush=True)
                else:
                    run_step(label, cmd, time.time() + 3600, args.dry_run)

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
