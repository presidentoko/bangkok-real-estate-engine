"""Unit tests for per-developer aggregation.
  python -m unittest tests.test_developer_agg
"""
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.analysis.developer import aggregate_developers, _mean  # noqa: E402


class TestAggregate(unittest.TestCase):
    def test_groups_and_averages(self):
        rows = [
            {"developer_slug": "sansiri-d42", "developer": "Sansiri",
             "developer_project_count": 298, "developer_unit_count": 104728,
             "gross_yield_pct": 5.0, "foreign_quota_inventory_pct": 30.0},
            {"developer_slug": "sansiri-d42", "developer": "Sansiri",
             "developer_project_count": 298, "developer_unit_count": 104728,
             "gross_yield_pct": 7.0, "foreign_quota_inventory_pct": 50.0},
            {"developer_slug": "small-d9", "developer": "Small Co",
             "developer_project_count": 1, "developer_unit_count": 80,
             "gross_yield_pct": None, "foreign_quota_inventory_pct": None},
        ]
        out = {d["developer_slug"]: d for d in aggregate_developers(rows)}
        self.assertEqual(len(out), 2)
        s = out["sansiri-d42"]
        self.assertEqual(s["developer_name"], "Sansiri")
        self.assertEqual(s["tracked_buildings"], 2)
        self.assertEqual(s["fazwaz_project_count"], 298)
        self.assertEqual(s["avg_gross_yield_pct"], 6.0)
        self.assertEqual(s["avg_foreign_quota_pct"], 40.0)
        # developer with only nulls -> averages are None, still counted
        sm = out["small-d9"]
        self.assertEqual(sm["tracked_buildings"], 1)
        self.assertIsNone(sm["avg_gross_yield_pct"])

    def test_ignores_rows_without_slug(self):
        out = aggregate_developers([{"developer_slug": None, "developer": "X"}])
        self.assertEqual(out, [])

    def test_mean_helper(self):
        self.assertEqual(_mean([2, 4, None]), 3.0)
        self.assertIsNone(_mean([None, None]))
        self.assertIsNone(_mean([]))


if __name__ == "__main__":
    unittest.main()
