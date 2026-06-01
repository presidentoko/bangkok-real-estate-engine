"""Unit tests for the pure resale-liquidity scoring core.

Run from repo root:  python -m unittest tests.test_liquidity
No third-party deps — stdlib unittest only.
"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.analysis.liquidity import score_liquidity, _decay, _median  # noqa: E402


class TestHelpers(unittest.TestCase):
    def test_median_odd_even(self):
        self.assertEqual(_median([3, 1, 2]), 2.0)
        self.assertEqual(_median([4, 1, 2, 3]), 2.5)
        self.assertIsNone(_median([]))

    def test_decay_bounds(self):
        self.assertEqual(_decay(10), 100.0)     # fast clear
        self.assertEqual(_decay(30), 100.0)     # at the fast edge
        self.assertEqual(_decay(400), 0.0)      # past slow edge
        mid = _decay(197.5)                      # ~midpoint of 30..365
        self.assertTrue(40 < mid < 60)


class TestScoreLiquidity(unittest.TestCase):
    def test_insufficient_data(self):
        r = score_liquidity([100], [50])  # only 2 obs < MIN_OBS
        self.assertIsNone(r["score"])
        self.assertEqual(r["grade"], "insufficient_data")
        self.assertEqual(r["sample_size"], 2)

    def test_highly_liquid_fast_clearing(self):
        # Everything cleared, and fast (~3 weeks). Should grade high.
        r = score_liquidity([10, 12], [15, 20, 18, 22])
        self.assertGreaterEqual(r["score"], 75)
        self.assertEqual(r["grade"], "high")
        self.assertEqual(r["sample_size"], 6)
        self.assertGreater(r["absorption_rate"], 60)

    def test_illiquid_nothing_clears_sitting_long(self):
        # Nothing absorbed, lots of stale active inventory sitting ~1.5y.
        r = score_liquidity([500, 520, 540, 560, 600], [])
        self.assertLess(r["score"], 20)
        self.assertEqual(r["grade"], "illiquid")
        self.assertEqual(r["absorption_rate"], 0.0)
        self.assertIsNone(r["median_sold_dom"])

    def test_moderate_mixed(self):
        # Half cleared (in ~3 months), half still sitting a few months.
        r = score_liquidity([90, 120, 100], [80, 95, 110])
        self.assertGreater(r["score"], 30)
        self.assertLess(r["score"], 75)
        self.assertIn(r["grade"], {"moderate", "good"})
        self.assertEqual(r["median_sold_dom"], 95)

    def test_absorption_rate_reported(self):
        r = score_liquidity([10, 10], [10, 10])  # 2 of 4 cleared
        self.assertEqual(r["absorption_rate"], 50.0)
        self.assertEqual(r["sample_size"], 4)

    def test_negative_and_none_doms_ignored(self):
        r = score_liquidity([10, -5, None], [20, 30, None, -1])
        # valid: active[10], absorbed[20,30] -> 3 obs < MIN_OBS=4
        self.assertEqual(r["sample_size"], 3)
        self.assertIsNone(r["score"])


if __name__ == "__main__":
    unittest.main()
