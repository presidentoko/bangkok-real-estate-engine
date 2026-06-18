"""End-to-end DotProperty city sweep + Bangkok enrichment.

Order of operations (serial — no concurrent writers to condos/listings):
  1. ingest_dotproperty for each of [chiang-mai, phuket, pattaya, hua-hin]
     with --listing-type both --ingest-unmatched
     (these 4 are NOT in the secondary-city sweep list)
  2. sweep_dotproperty_thailand for the ~50 secondary/Thailand-wide cities
  3. enrich_buildings (Tier A) on Bangkok
  4. enrich_buildings_b (Tier B) on Bangkok

DDProperty + FazWaz sweeps stay manual because they need a one-time
Cloudflare Turnstile click — see README at the bottom of this docstring.

Usage:
  python scripts/full_city_sweep.py
  python scripts/full_city_sweep.py --skip-secondary    # only the 4 main cities
  python scripts/full_city_sweep.py --skip-enrich       # listings only, no enrichment
  python scripts/full_city_sweep.py --cities pattaya phuket   # custom subset
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# DB province slug → DotProperty URL slug (kebab-case).
MAIN_CITY_URL_SLUGS = {
    "chiangmai": "chiang-mai",
    "phuket":    "phuket",
    "pattaya":   "pattaya",
    "huahin":    "hua-hin",
}


def run(label: str, cmd: list[str]) -> int:
    print(f"\n{'='*64}", flush=True)
    print(f"STARTING: {label}", flush=True)
    print(f"  cmd: {' '.join(cmd)}", flush=True)
    print(f"{'='*64}", flush=True)
    t0 = time.time()
    result = subprocess.run(cmd, cwd=ROOT)
    elapsed = time.time() - t0
    status = "OK" if result.returncode == 0 else f"FAILED (exit {result.returncode})"
    print(f"\n{label}: {status} in {elapsed/60:.1f} min", flush=True)
    return result.returncode


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cities",
        nargs="+",
        default=list(MAIN_CITY_URL_SLUGS.keys()),
        choices=list(MAIN_CITY_URL_SLUGS.keys()),
        help="Main-city subset (default: all 4)",
    )
    ap.add_argument("--skip-secondary", action="store_true",
                    help="Skip the ~50-city Thailand-wide sweep")
    ap.add_argument("--skip-enrich", action="store_true",
                    help="Skip Tier A + Tier B enrichment passes")
    ap.add_argument("--delay-s", type=float, default=1.5,
                    help="Delay between page fetches for main-city ingest")
    args = ap.parse_args()

    python = sys.executable
    jobs: list[tuple[str, list[str]]] = []

    for db_slug in args.cities:
        url_slug = MAIN_CITY_URL_SLUGS[db_slug]
        jobs.append((
            f"DotProperty main-city  {db_slug}  (both, ingest-unmatched)",
            [
                python, "scripts/ingest_dotproperty.py",
                "--city", url_slug,
                "--listing-type", "both",
                "--ingest-unmatched",
                "--delay-s", str(args.delay_s),
            ],
        ))

    if not args.skip_secondary:
        jobs.append((
            "DotProperty Thailand-wide sweep (~50 secondary cities)",
            [python, "scripts/sweep_dotproperty_thailand.py"],
        ))

    if not args.skip_enrich:
        jobs.append((
            "Hipflat Tier A enrichment",
            [python, "scripts/enrich_buildings.py"],
        ))
        jobs.append((
            "Hipflat Tier B enrichment",
            [python, "scripts/enrich_buildings_b.py"],
        ))

    print(f"Planned jobs ({len(jobs)}):")
    for label, _ in jobs:
        print(f"  • {label}")

    overall_start = time.time()
    results: list[tuple[str, int]] = []
    for label, cmd in jobs:
        rc = run(label, cmd)
        results.append((label, rc))

    print(f"\n{'='*64}")
    print(f"FULL CITY SWEEP COMPLETE in {(time.time()-overall_start)/60:.1f} min")
    print(f"{'='*64}")
    for label, rc in results:
        print(f"  {'OK  ' if rc == 0 else 'FAIL':4}  {label}")

    return 0 if all(rc == 0 for _, rc in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
