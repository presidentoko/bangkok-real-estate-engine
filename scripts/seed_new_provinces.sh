#!/usr/bin/env bash
# Seed Chonburi → Pattaya → Hua Hin condos in sequence (Chrome profile shared,
# so no concurrency). Pattaya runs after Chonburi so Pattaya-city buildings
# (subset of Chonburi province) get re-tagged province='pattaya' on upsert.
#
#   bash scripts/seed_new_provinces.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p logs

echo "=== seed condo chonburi ===" | tee -a logs/seed_new_provinces.log
PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type condo --region chonburi 2>&1 | tee -a logs/seed_new_provinces.log

echo "=== seed condo pattaya ===" | tee -a logs/seed_new_provinces.log
PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type condo --region pattaya 2>&1 | tee -a logs/seed_new_provinces.log

echo "=== seed condo huahin ===" | tee -a logs/seed_new_provinces.log
PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type condo --region huahin 2>&1 | tee -a logs/seed_new_provinces.log

echo "=== DONE ===" | tee -a logs/seed_new_provinces.log
