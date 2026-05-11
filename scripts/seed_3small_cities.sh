#!/usr/bin/env bash
# Seed condo + apartment + serviced-apartment for Krabi, Koh Samui (Surat
# Thani), and Chiang Rai. Smaller foreigner markets but completes the
# Thai condo SEO surface.
set -e
cd "$(dirname "$0")/.."
mkdir -p logs

for region in krabi samui chiangrai; do
  for ptype in condo apartment serviced-apartment; do
    echo "=== seed $ptype $region ===" | tee -a logs/seed_3small_cities.log
    PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type "$ptype" --region "$region" 2>&1 | tee -a logs/seed_3small_cities.log
  done
done

echo "=== Tier A for new buildings ===" | tee -a logs/seed_3small_cities.log
PYTHONIOENCODING=utf-8 python scripts/enrich_buildings.py 2>&1 | tee -a logs/seed_3small_cities.log

echo "=== Tier B for new buildings + recent stale ===" | tee -a logs/seed_3small_cities.log
PYTHONIOENCODING=utf-8 python scripts/enrich_buildings_b.py 2>&1 | tee -a logs/seed_3small_cities.log

echo "=== OSM livability for new ===" | tee -a logs/seed_3small_cities.log
PYTHONIOENCODING=utf-8 python scripts/populate_livability_osm.py 2>&1 | tee -a logs/seed_3small_cities.log

echo "=== Recompute scores ===" | tee -a logs/seed_3small_cities.log
PYTHONIOENCODING=utf-8 python scripts/compute_value_scores.py 2>&1 | tee -a logs/seed_3small_cities.log

echo "=== DONE ===" | tee -a logs/seed_3small_cities.log
