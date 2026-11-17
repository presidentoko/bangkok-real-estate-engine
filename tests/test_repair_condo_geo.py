"""Tests for the pure helpers in scripts/repair_condo_geo_all_sources.py.

Run from repo root:  python -m pytest tests/test_repair_condo_geo.py
"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from scripts.repair_condo_geo_all_sources import corrected_province, placeholder_points  # noqa: E402
from src.db import canonical_region_name  # noqa: E402


def condo(slug, province, lat, lng, name=None):
    return {"slug": slug, "province": province, "latitude": lat, "longitude": lng, "name": name or slug}


class TestCorrectedProvince(unittest.TestCase):
    def test_phuket_point_filed_as_bangkok(self):
        self.assertEqual(corrected_province(condo("x-bangkok-2", "bangkok", 8.02, 98.31)), "phuket")

    def test_bangkok_point_stays(self):
        self.assertIsNone(corrected_province(condo("x-bangkok", "bangkok", 13.73, 100.56)))

    def test_samui_row_on_the_mainland(self):
        self.assertEqual(corrected_province(condo("x-ko-samui", "ko-samui", 9.09, 99.36)), "surat-thani")
        self.assertIsNone(corrected_province(condo("y-ko-samui", "ko-samui", 9.53, 100.04)))

    def test_placeholder_point_moves_nothing(self):
        pts = {(8.02, 98.31)}
        self.assertIsNone(corrected_province(condo("x-bangkok-2", "bangkok", 8.02, 98.31), pts))

    def test_no_coordinates(self):
        self.assertIsNone(corrected_province(condo("x", "bangkok", None, None)))


class TestPlaceholderPoints(unittest.TestCase):
    def test_five_unrelated_names_on_one_point(self):
        rows = [condo(f"c{i}", "bangkok", 13.72397, 100.57776, n)
                for i, n in enumerate(["La Vie", "IDEO Q", "59 Heritage", "The Bangkok", "Noble Remix"])]
        self.assertEqual(placeholder_points(rows), {(13.72397, 100.57776)})

    def test_one_projects_phases_are_not_a_placeholder(self):
        rows = [condo(f"c{i}", "pattaya", 12.94666, 100.92792, f"New Nordic {n}")
                for i, n in enumerate(["Castle 1", "Castle 2", "Trend 2", "Trend 4", "VIP"])]
        self.assertEqual(placeholder_points(rows), set())

    def test_four_names_is_not_enough(self):
        rows = [condo(f"c{i}", "bangkok", 13.7, 100.5, f"N{i}") for i in range(4)]
        self.assertEqual(placeholder_points(rows), set())


class TestRegionAlias(unittest.TestCase):
    def test_wang_thonglang_has_one_spelling(self):
        self.assertEqual(canonical_region_name("Wang Thong Lang"), "wang-thonglang")
        self.assertEqual(canonical_region_name("wang-thonglang"), "wang-thonglang")


if __name__ == "__main__":
    unittest.main()
