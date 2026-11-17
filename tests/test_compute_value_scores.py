"""Tests for the pure scoring helpers in scripts/compute_value_scores.py.

Run from repo root:  python -m pytest tests/test_compute_value_scores.py
"""
import os
import statistics
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from compute_value_scores import score_buildings, thb_pps  # noqa: E402


class TestThbPps(unittest.TestCase):
    def test_usd_is_converted(self):
        self.assertEqual(thb_pps({"price_per_sqm": 2000, "currency": "USD", "area_sqm": 35}, 34), 68000)

    def test_implausible_rows_are_dropped(self):
        self.assertIsNone(thb_pps({"price_per_sqm": 2490, "currency": "USD", "area_sqm": 563}, 34))  # sqft area
        self.assertIsNone(thb_pps({"price_per_sqm": 50, "currency": "THB", "area_sqm": 35}, 34))
        self.assertIsNone(thb_pps({"price_per_sqm": 70000, "currency": "EUR", "area_sqm": 35}, 34))


class TestScoreBuildings(unittest.TestCase):
    def test_each_city_centres_on_100(self):
        # Pattaya with no district rows, Bangkok district rows: both centre on 100,
        # whatever their price level (the bug: Pattaya median bubble 23).
        pps = {f"p{i}": 40000 + 1000 * i for i in range(7)}
        pps.update({f"b{i}": 150000 + 5000 * i for i in range(7)})
        region = {**{f"p{i}": None for i in range(7)}, **{f"b{i}": "vadhana" for i in range(7)}}
        prov = {**{f"p{i}": "pattaya" for i in range(7)}, **{f"b{i}": "bangkok" for i in range(7)}}
        scores, region_med = score_buildings(pps, region, prov)
        self.assertAlmostEqual(statistics.median(scores[f"p{i}"] for i in range(7)), 100.0)
        self.assertAlmostEqual(statistics.median(scores[f"b{i}"] for i in range(7)), 100.0)
        self.assertIn("vadhana", region_med)

    def test_bangkok_without_district_is_not_scored(self):
        pps = {f"b{i}": 100000 for i in range(6)}
        scores, _ = score_buildings(pps, {k: None for k in pps}, {k: "bangkok" for k in pps})
        self.assertEqual(scores, {})

    def test_out_of_range_is_null(self):
        pps = {f"c{i}": 100000 for i in range(5)}
        pps["x"] = 1_000_000
        scores, _ = score_buildings(pps, {k: "r" for k in pps}, {k: "phuket" for k in pps})
        self.assertIsNone(scores["x"])


if __name__ == "__main__":
    unittest.main()
