#!/usr/bin/env bash
# Sequential enrichment for newly seeded property types (apartment + serviced).
# Run this once condo data is stable; no concurrency with the condo enrich job
# because nodriver shares one Chrome profile dir.
#
#   bash scripts/enrich_new_types.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p logs

echo "=== seed serviced-apartment ===" | tee -a logs/enrich_new_types.log
PYTHONIOENCODING=utf-8 python scripts/seed_buildings.py --type serviced-apartment 2>&1 | tee -a logs/enrich_new_types.log

echo "=== Tier A (geo + JSON-LD) for new buildings ===" | tee -a logs/enrich_new_types.log
PYTHONIOENCODING=utf-8 python scripts/enrich_buildings.py 2>&1 | tee -a logs/enrich_new_types.log

echo "=== Tier B (units + chart + facilities) ===" | tee -a logs/enrich_new_types.log
PYTHONIOENCODING=utf-8 python scripts/enrich_buildings_b.py 2>&1 | tee -a logs/enrich_new_types.log

echo "=== Risk factors (flood) ===" | tee -a logs/enrich_new_types.log
PYTHONIOENCODING=utf-8 python scripts/populate_risk_factors.py 2>&1 | tee -a logs/enrich_new_types.log

echo "=== OSM Overpass (transit + amenity counts) ===" | tee -a logs/enrich_new_types.log
PYTHONIOENCODING=utf-8 python scripts/populate_livability_osm.py 2>&1 | tee -a logs/enrich_new_types.log

echo "=== Value scores (bubble_index for new condo types where applicable) ===" | tee -a logs/enrich_new_types.log
PYTHONIOENCODING=utf-8 python scripts/compute_value_scores.py 2>&1 | tee -a logs/enrich_new_types.log

echo "=== DONE ===" | tee -a logs/enrich_new_types.log
