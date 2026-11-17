"""Tests for the listing plausibility filter in scripts/compute_yields.py.

Run from repo root:  python -m pytest tests/test_compute_yields.py
"""
import importlib.util
import io
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

_spec = importlib.util.spec_from_file_location(
    "compute_yields", os.path.join(ROOT, "scripts", "compute_yields.py"))
_mod = importlib.util.module_from_spec(_spec)
_stdout = sys.stdout
sys.stdout = io.TextIOWrapper(io.BytesIO())  # the script rewraps stdout on import
try:
    _spec.loader.exec_module(_mod)
finally:
    sys.stdout = _stdout
plausible_thb = _mod.plausible_thb


class TestPlausibleThb(unittest.TestCase):
    def test_thb_passes_through(self):
        self.assertEqual(plausible_thb({"price": 25000, "currency": "THB", "area_sqm": 35}, "rent", 34), 25000)

    def test_usd_converts(self):
        self.assertEqual(plausible_thb({"price": 800, "currency": "USD", "area_sqm": 35}, "rent", 34), 27200)
        self.assertEqual(plausible_thb({"price": 100000, "currency": "USD", "area_sqm": 35}, "sale", 34), 3400000)

    def test_mistagged_baht_rent_is_dropped(self):
        # The Master Sukhumvit On Nut: "USD 9,001" is really ฿9,001.
        self.assertIsNone(plausible_thb({"price": 9001, "currency": "USD", "area_sqm": None}, "rent", 34))

    def test_whole_floor_or_sqft_area_is_dropped(self):
        self.assertIsNone(plausible_thb({"price": 2070207, "currency": "USD", "area_sqm": 587}, "sale", 34))
        self.assertIsNone(plausible_thb({"price": 400000, "currency": "THB", "area_sqm": 769}, "rent", 34))

    def test_tiny_usd_sale_and_other_currency_dropped(self):
        self.assertIsNone(plausible_thb({"price": 5000, "currency": "USD", "area_sqm": 30}, "sale", 34))
        self.assertIsNone(plausible_thb({"price": 5000, "currency": "EUR", "area_sqm": 30}, "rent", 34))


if __name__ == "__main__":
    unittest.main()
