"""Unit test for FazWaz project-page developer extraction.

Runs against the captured sample at debug_html/fazwaz_project_sample.html.
  python -m unittest tests.test_fazwaz_developer
"""
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.scrapers.fazwaz_project import parse_developer  # noqa: E402

SAMPLE = ROOT / "debug_html" / "fazwaz_project_sample.html"


class TestParseDeveloper(unittest.TestCase):
    @unittest.skipUnless(SAMPLE.exists(), "captured sample not present")
    def test_real_sample(self):
        html = SAMPLE.read_text(encoding="utf-8")
        d = parse_developer(html)
        self.assertEqual(d.get("developer"), "Bkk Grand Estate.Co., Ltd.")
        self.assertEqual(d.get("developer_slug"), "bkk-grand-estateco-ltd-d1710")
        self.assertEqual(d.get("developer_project_count"), 1)
        self.assertEqual(d.get("developer_unit_count"), 820)

    def test_synthetic_strip_and_counts(self):
        html = """
        <div class="header-data--developer-info">
          <h3 class="header-data-topic">About the Developer - Sansiri PCL</h3>
          <a class="developer-info__developer-all"
             href="https://www.fazwaz.com/property-developers/sansiri-pcl-d42">All Sansiri PCL Projects</a>
        </div>
        <div class="developer-info">
          <span class="developer-info-count__project">57 Projects</span>
          <span class="developer-info-count__unit">12,430 Units</span>
        </div>
        """
        d = parse_developer(html)
        self.assertEqual(d["developer"], "Sansiri PCL")
        self.assertEqual(d["developer_slug"], "sansiri-pcl-d42")
        self.assertEqual(d["developer_project_count"], 57)
        self.assertEqual(d["developer_unit_count"], 12430)

    def test_absent_developer_block(self):
        self.assertEqual(parse_developer("<html><body>no dev here</body></html>"), {})


if __name__ == "__main__":
    unittest.main()
