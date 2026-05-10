#!/usr/bin/env bash
# Seed apartment + serviced-apartment buildings for the 5 non-Bangkok
# provinces. Serial because nodriver shares one Chrome profile dir.
# Tier A enrichment at the end picks up everything new.
#
#   bash scripts/seed_apt_5cities.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p logs

for region in chonburi pattaya huahin phuket chiangmai; do
  for ptype in apartment serviced-apartment; do
    echo "=== seed $ptype $region ===" | tee -a logs/seed_apt_5cities.log
    PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type "$ptype" --region "$region" 2>&1 | tee -a logs/seed_apt_5cities.log
  done
done

echo "=== Tier A (geo + JSON-LD) for new buildings ===" | tee -a logs/seed_apt_5cities.log
PYTHONIOENCODING=utf-8 python scripts/enrich_buildings.py 2>&1 | tee -a logs/seed_apt_5cities.log

echo "=== DONE ===" | tee -a logs/seed_apt_5cities.log
