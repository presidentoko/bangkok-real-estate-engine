"""Static Bangkok district → land-subsidence level (0..5).

Bangkok sits on soft marine clay and sank as fast as ~120 mm/yr in the early
1980s from groundwater over-extraction. Groundwater regulation has since cut
inner-city rates to ~0–10 mm/yr, but the eastern soft-clay belt and the coastal
south keep subsiding, and neighbouring Samut Prakan is still accelerating —
which compounds the same areas' monsoon-flood exposure.

This is a COARSE, district-level relative ground-stability proxy compiled from
publicly available studies (not per-coordinate survey data):
  - InSAR time-series analyses of Bangkok subsidence (ScienceDirect 2024;
    GEO2TECDI EU/Thailand InSAR poster)
  - Royal Irrigation Dept / DGR groundwater-monitoring benchmark records
    (Ratchathewi, Hua Mak, Lat Krabang, Min Buri, Bang Phli time series)
  - Frontiers (2024) global coastal-city subsidence database

Levels (current-state, relative):
  5 — severe — coastal subsidence + sea-level rise compounding
  4 — high   — eastern soft-clay belt, documented elevated subsidence
  3 — moderate — transitional outer east/north, historical hotspots
  2 — low    — outer ring, largely stabilised
  1 — very low — consolidated inner core, groundwater regulated, ~0 today

Refresh as new InSAR studies publish. Districts not listed return None.
"""

SUBSIDENCE_LEVEL_BY_DISTRICT: dict[str, int] = {
    # severe — only Bangkok khet on the Gulf; chronic subsidence + sea-level.
    "Bang Khun Thian": 5,

    # high — eastern soft-clay belt; the benchmark records with the largest
    # historical and still-elevated subsidence (Lat Krabang/Min Buri/Nong Chok).
    "Nong Chok": 4,
    "Lat Krabang": 4,
    "Min Buri": 4,
    "Khlong Sam Wa": 4,

    # moderate — outer east/north + historical hotspots (Hua Mak ≈ Bang Kapi/
    # Suan Luang once hit ~100 mm/yr) and the Samut Prakan-adjacent south-east
    # (Bang Na borders fast-sinking Bang Phli).
    "Saphan Sung": 3,
    "Prawet": 3,
    "Bang Kapi": 3,
    "Suan Luang": 3,
    "Lat Phrao": 3,
    "Bueng Kum": 3,
    "Khan Na Yao": 3,
    "Bang Na": 3,
    "Sai Mai": 3,
    "Thung Khru": 3,
    "Rat Burana": 3,

    # low — outer ring, largely stabilised under groundwater rules.
    "Don Mueang": 2,
    "Lak Si": 2,
    "Bang Khen": 2,
    "Wang Thonglang": 2,
    "Phra Khanong": 2,
    "Chom Thong": 2,
    "Nong Khaem": 2,
    "Bang Khae": 2,
    "Bang Bon": 2,
    "Taling Chan": 2,
    "Thawi Watthana": 2,
    "Bang Phlat": 2,
    "Phasi Charoen": 2,
    "Chatuchak": 2,
    "Bang Sue": 2,
    "Khlong Toei": 2,
    "Huai Khwang": 2,
    "Yan Nawa": 2,
    "Bang Kho Laem": 2,
    "Khlong San": 2,
    "Thon Buri": 2,
    "Bangkok Noi": 2,
    "Bangkok Yai": 2,

    # very low — consolidated inner core, groundwater long regulated, ~0 today.
    "Phra Nakhon": 1,
    "Pathum Wan": 1,
    "Bang Rak": 1,
    "Sathon": 1,
    "Dusit": 1,
    "Ratchathewi": 1,
    "Phaya Thai": 1,
    "Din Daeng": 1,
    "Vadhana": 1,
    "Samphanthawong": 1,
    "Pom Prap Sattru Phai": 1,
}


def get_subsidence_level(district: str | None) -> int | None:
    """Return 0..5 land-subsidence level, or None if district unknown."""
    if not district:
        return None
    return SUBSIDENCE_LEVEL_BY_DISTRICT.get(district)
