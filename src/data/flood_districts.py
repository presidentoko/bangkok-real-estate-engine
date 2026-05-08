"""Static Bangkok district → monsoon flood risk level (0..5).

Compiled from publicly available, non-proprietary references:
  - 2011 Great Flood inundation extent (BMA, World Bank post-disaster reports)
  - BMA Drainage & Sewerage Department recurring monsoon flood maps (annual)
  - JICA "Capacity Development on Flood Counter-Measures for Bangkok
    Metropolitan Region" technical reports
  - Wikipedia 2011 Thailand floods (cross-checked municipal sources)

Levels:
  5 — severe / repeat full-area inundation in monsoon (worst hit 2011)
  4 — high — significant 2011 flooding, recurring waist-deep water
  3 — moderate — neighborhood-level surface flooding common
  2 — low — occasional puddling on heavy storms
  1 — very low — central elevated, well-drained
  0 — none observed (rare in BKK proper)

Refresh annually. To upgrade to per-coordinate lookup, populate
src/analysis/risk.py:_flood_level_geojson() with a real BMA GIS endpoint.
"""

FLOOD_RISK_BY_DISTRICT: dict[str, int] = {
    # north + east outskirts — worst hit 2011, recurring annual flooding.
    # Bang Khun Thian: southernmost coastal district, only Bangkok khet
    # bordering the Gulf — chronic subsidence + sea-level rise on top of
    # monsoon. Severe by every available source.
    "Don Mueang": 5,
    "Lak Si": 5,
    "Sai Mai": 5,
    "Bang Khen": 5,
    "Min Buri": 5,
    "Khlong Sam Wa": 5,
    "Nong Chok": 5,
    "Lat Krabang": 5,
    "Bang Khun Thian": 5,

    # high — heavy 2011 + recurring waist-deep flooding
    "Khan Na Yao": 4,
    "Bueng Kum": 4,
    "Thawi Watthana": 4,
    "Bang Phlat": 4,
    "Taling Chan": 4,
    "Nong Khaem": 4,
    "Bang Bon": 4,
    "Bang Khae": 4,
    "Saphan Sung": 4,
    "Prawet": 4,

    # moderate — riverside, lowland pockets, periodic flooding
    "Chatuchak": 3,
    "Bang Sue": 3,
    "Phra Khanong": 3,
    "Yan Nawa": 3,
    "Bangkok Yai": 3,
    "Bangkok Noi": 3,
    "Chom Thong": 3,
    "Rat Burana": 3,
    "Bang Kho Laem": 3,
    "Khlong San": 3,
    "Lat Phrao": 3,
    "Wang Thonglang": 3,
    "Suan Luang": 3,
    "Bang Kapi": 3,
    "Bang Na": 3,
    "Thon Buri": 3,
    "Thung Khru": 3,
    "Phasi Charoen": 3,

    # low — mostly OK, only riverside-edge risk
    "Khlong Toei": 2,
    "Vadhana": 2,
    "Phaya Thai": 2,
    "Din Daeng": 2,
    "Huai Khwang": 2,
    "Dusit": 2,
    "Phra Nakhon": 2,
    "Samphanthawong": 2,

    # very low — central elevated, robust drainage
    "Pathum Wan": 1,
    "Bang Rak": 1,
    "Sathon": 1,
    "Ratchathewi": 1,
    "Pom Prap Sattru Phai": 1,
}


def get_flood_level(district: str | None) -> int | None:
    """Return 0..5 risk level, or None if district unknown."""
    if not district:
        return None
    return FLOOD_RISK_BY_DISTRICT.get(district)
