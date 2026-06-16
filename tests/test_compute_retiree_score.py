# tests/test_compute_retiree_score.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.compute_retiree_score import compute_score


def test_excellent_score():
    # 4 hospitals, AQI 25, 300m transit, 3 supermarkets → near-max
    # healthcare=100*0.4 + air=100*0.25 + transit=100*0.2 + errands=95*0.15 = 99.25
    score = compute_score(hospitals=4, aqi=25, nearest_bts_m=300, nearest_mrt_m=None, supermarkets=3)
    assert score is not None
    assert score >= 95.0


def test_no_hospitals_gives_low_score():
    # healthcare=10*0.4=4 + air=85*0.25=21.25 + transit=85*0.2=17 + errands=55*0.15=8.25 = 50.5
    score = compute_score(hospitals=0, aqi=50, nearest_bts_m=500, nearest_mrt_m=None, supermarkets=1)
    assert score is not None
    assert score < 55.0  # below "good" threshold


def test_missing_livability_returns_none():
    score = compute_score(hospitals=None, aqi=50, nearest_bts_m=500, nearest_mrt_m=None, supermarkets=1)
    assert score is None


def test_missing_aqi_renormalises():
    # Without AQI: weights renormalised across 3 components (0.4+0.2+0.15=0.75 denom)
    score = compute_score(hospitals=1, aqi=None, nearest_bts_m=500, nearest_mrt_m=None, supermarkets=1)
    assert score is not None
    assert score > 0


def test_uses_closer_transit_station():
    # min(300, 2000) == min(2000, 300) == 300 → same transit score either way
    score_a = compute_score(hospitals=1, aqi=50, nearest_bts_m=300, nearest_mrt_m=2000, supermarkets=1)
    score_b = compute_score(hospitals=1, aqi=50, nearest_bts_m=2000, nearest_mrt_m=300, supermarkets=1)
    assert score_a == score_b


def test_score_clamped_0_to_100():
    # pathological values shouldn't escape the range
    score = compute_score(hospitals=999, aqi=1, nearest_bts_m=0, nearest_mrt_m=0, supermarkets=999)
    assert score is not None
    assert 0.0 <= score <= 100.0
