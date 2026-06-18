"""Run FazWaz ingest across the 5 supported Thai cities (sale + rent).

FazWaz uses nodriver (Cloudflare). First city × first run may need a one-time
Turnstile click; subsequent calls reuse the .nodriver-profile-fazwaz/ cookies.
Browser stays headed so manual intervention is possible.

Usage:
  python scripts/sweep_fazwaz_thailand.py
  python scripts/sweep_fazwaz_thailand.py --cities pattaya phuket
  python scripts/sweep_fazwaz_thailand.py --limit 300 --delay-s 12
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

DEFAULT_CITIES = ["pattaya", "phuket", "chiang-mai", "hua-hin", "bangkok"]
LISTING_TYPES = ["sale", "rent"]

# Extra pause between (city × type) runs so the browser can settle.
INTER_RUN_DELAY_S = 30


def run(label: str, cmd: list[str]) -> int:
    print(f"\n{'='*64}", flush=True)
    print(f"STARTING: {label}", flush=True)
    print(f"  cmd: {' '.join(cmd)}", flush=True)
    print(f"{'='*64}", flush=True)
    t0 = time.time()
    rc = subprocess.run(cmd, cwd=ROOT).returncode
    elapsed = time.time() - t0
    status = "OK" if rc == 0 else f"FAILED (exit {rc})"
    print(f"\n{label}: {status} in {elapsed/60:.1f} min", flush=True)
    return rc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", nargs="+", default=DEFAULT_CITIES,
                    help="City slugs in FazWaz format (default: 5 main cities)")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--delay-s", type=float, default=12.0,
                    help="Delay between page fetches (sec)")
    args = ap.parse_args()

    python = sys.executable
    results: list[tuple[str, int]] = []
    overall_start = time.time()

    for i, city in enumerate(args.cities, 1):
        for lt in LISTING_TYPES:
            label = f"[{i}/{len(args.cities)}] FazWaz  {city.upper()}  {lt}"
            cmd = [
                python, "scripts/ingest_fazwaz.py",
                "--city", city,
                "--listing-type", lt,
                "--delay-s", str(args.delay_s),
            ]
            if args.limit is not None:
                cmd += ["--limit", str(args.limit)]
            rc = run(label, cmd)
            results.append((label, rc))
            print(f"  sleeping {INTER_RUN_DELAY_S}s before next run...", flush=True)
            time.sleep(INTER_RUN_DELAY_S)

    print(f"\n{'='*64}")
    print(f"FAZWAZ SWEEP COMPLETE in {(time.time()-overall_start)/60:.1f} min")
    print(f"{'='*64}")
    for label, rc in results:
        print(f"  {'OK  ' if rc == 0 else 'FAIL':4}  {label}")
    return 0 if all(rc == 0 for _, rc in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
