"""Overnight batch: DotProperty Thailand sweep → Tier A enrichment → Tier B enrichment.

Runs the three jobs sequentially, logging elapsed time for each.

Usage:
  python scripts/overnight_run.py
"""
from __future__ import annotations

import io
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def run(label: str, cmd: list[str]) -> int:
    print(f"\n{'='*60}", flush=True)
    print(f"STARTING: {label}", flush=True)
    print(f"{'='*60}", flush=True)
    t0 = time.time()
    result = subprocess.run(cmd, cwd=ROOT)
    elapsed = time.time() - t0
    status = "OK" if result.returncode == 0 else f"FAILED (exit {result.returncode})"
    print(f"\n{label}: {status} in {elapsed/60:.1f} min", flush=True)
    return result.returncode


if __name__ == "__main__":
    python = sys.executable
    jobs = [
        ("DotProperty Thailand sweep",
         [python, "scripts/sweep_dotproperty_thailand.py"]),
        ("Hipflat Tier A enrichment",
         [python, "scripts/enrich_buildings.py"]),
        ("Hipflat Tier B enrichment",
         [python, "scripts/enrich_buildings_b.py"]),
    ]

    overall_start = time.time()
    results = []
    for label, cmd in jobs:
        rc = run(label, cmd)
        results.append((label, rc))

    print(f"\n{'='*60}")
    print(f"OVERNIGHT RUN COMPLETE in {(time.time()-overall_start)/60:.1f} min")
    for label, rc in results:
        print(f"  {'OK' if rc == 0 else 'FAIL':4}  {label}")
