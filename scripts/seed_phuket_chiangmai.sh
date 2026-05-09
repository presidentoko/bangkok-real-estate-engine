#!/usr/bin/env bash
# Seed Phuket + Chiang Mai condos. Chrome profile is shared with other
# nodriver tasks, so this runs serial. New rows are upserted with
# province='phuket'/'chiangmai' and published=false (site stays Bangkok-only).
#
#   bash scripts/seed_phuket_chiangmai.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p logs

echo "=== seed condo phuket ===" | tee -a logs/seed_phuket_chiangmai.log
PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type condo --region phuket 2>&1 | tee -a logs/seed_phuket_chiangmai.log

echo "=== seed condo chiangmai ===" | tee -a logs/seed_phuket_chiangmai.log
PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type condo --region chiangmai 2>&1 | tee -a logs/seed_phuket_chiangmai.log

echo "=== Tier A (geo + JSON-LD) for new buildings ===" | tee -a logs/seed_phuket_chiangmai.log
PYTHONIOENCODING=utf-8 python scripts/enrich_buildings.py 2>&1 | tee -a logs/seed_phuket_chiangmai.log

echo "=== DONE ===" | tee -a logs/seed_phuket_chiangmai.log
