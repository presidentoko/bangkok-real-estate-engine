"""Wait for the current FazWaz sweep to finish, then chain:
  1. backfill_province.py (re-tag the new condos that landed in 'bangkok')
  2. luxury-thailand-engine/run_all.py (kick off luxury scrape sweep)

Polls the FW log file for the "FAZWAZ SWEEP COMPLETE" sentinel. Times out
after MAX_WAIT_S so we never run away if something hangs.

Usage:
  python scripts/post_sweep_chain.py
  python scripts/post_sweep_chain.py --fw-log logs/sweep_fazwaz_<TS>.log
"""
from __future__ import annotations

import argparse
import io
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

LUXURY_REPO = ROOT.parent / "luxury-thailand-engine"
POLL_INTERVAL_S = 30
MAX_WAIT_S = 24 * 3600  # 24 h hard cap


def latest_fw_log() -> Path:
    pointer = ROOT / "logs" / "fazwaz.latest"
    if pointer.exists():
        rel = pointer.read_text(encoding="utf-8").strip()
        p = ROOT / rel
        if p.exists():
            return p
    # Fallback: glob most recent.
    cands = sorted((ROOT / "logs").glob("sweep_fazwaz_*.log"))
    if not cands:
        raise FileNotFoundError("no FazWaz log files in logs/")
    return cands[-1]


SENTINEL = "FAZWAZ SWEEP COMPLETE"


def wait_for_sweep(log_path: Path) -> bool:
    """Block until SENTINEL appears in `log_path`. Returns True on success,
    False on timeout."""
    print(f"[chain] watching {log_path}")
    started = time.time()
    last_pos = 0
    while True:
        if log_path.exists():
            try:
                with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(last_pos)
                    chunk = f.read()
                    last_pos = f.tell()
                if SENTINEL in chunk:
                    print(f"[chain] sentinel found after {(time.time()-started)/60:.1f} min")
                    return True
            except Exception as e:
                print(f"[chain] log read err: {e}")
        if time.time() - started > MAX_WAIT_S:
            print("[chain] timeout — bailing")
            return False
        time.sleep(POLL_INTERVAL_S)


def run_step(label: str, cmd: list[str], cwd: Path) -> int:
    print(f"\n{'='*64}", flush=True)
    print(f"[chain] STEP: {label}", flush=True)
    print(f"  cmd: {' '.join(cmd)}", flush=True)
    print(f"  cwd: {cwd}", flush=True)
    print(f"{'='*64}", flush=True)
    t0 = time.time()
    rc = subprocess.run(cmd, cwd=cwd).returncode
    elapsed = (time.time() - t0) / 60
    status = "OK" if rc == 0 else f"FAILED (exit {rc})"
    print(f"\n[chain] {label}: {status} in {elapsed:.1f} min", flush=True)
    return rc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fw-log", default=None,
                    help="Override FazWaz log path (defaults to logs/fazwaz.latest)")
    ap.add_argument("--skip-wait", action="store_true",
                    help="Don't wait for sweep; run chain immediately")
    args = ap.parse_args()

    if not args.skip_wait:
        log_path = Path(args.fw_log) if args.fw_log else latest_fw_log()
        if not wait_for_sweep(log_path):
            return 1

    python = sys.executable

    # Step 1: backfill province for newly-scraped condos that defaulted to bangkok
    rc = run_step(
        "backfill_province (re-tag bangkok-default rows)",
        [python, "scripts/backfill_province.py"],
        cwd=ROOT,
    )
    # Continue even if backfill failed — luxury sweep is independent

    # Step 2: luxury Thailand engine — full sweep across all categories
    if LUXURY_REPO.exists():
        run_step(
            "luxury sweep (yachts + aircraft + cars + residences)",
            [python, "run_all.py"],
            cwd=LUXURY_REPO,
        )
    else:
        print(f"[chain] luxury repo not found at {LUXURY_REPO}; skipping")
        return 1

    print("\n[chain] DONE — backfill + luxury sweep finished")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
