"""scripts/condo_static/plan.py: page order keeps a building's locales together."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.condo_static.plan import order_pages  # noqa: E402


def test_locales_of_one_slug_are_adjacent():
    pages = [f"{lang}/{slug}" for slug in ("b-tower", "a-place", "c-view") for lang in ("th", "en", "ko")]
    out = order_pages(pages)
    assert out == [
        "en/a-place", "ko/a-place", "th/a-place",
        "en/b-tower", "ko/b-tower", "th/b-tower",
        "en/c-view", "ko/c-view", "th/c-view",
    ]


def test_dedupes_and_keeps_every_page():
    out = order_pages(["en/x", "en/x", "th/x"])
    assert out == ["en/x", "th/x"]


def test_slug_containing_slash_free_split():
    # slugs never contain "/", but the split must be on the first one only.
    assert order_pages(["ko/a-b", "en/a-b"]) == ["en/a-b", "ko/a-b"]
