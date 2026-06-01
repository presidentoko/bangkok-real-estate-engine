"""Bangkok district (khet) helpers.

Used to normalise free-text 'region' fields from scrapers into one of the
50 official Bangkok districts. This is critical for:
  - Bubble Index — region averages must aggregate at a meaningful unit, not
    fragment across "Sukhumvit Soi 11" / "Asoke" / "Phrom Phong".
  - Flood risk lookup — keyed by district.
  - Construction signal — keyed by district.
"""
from __future__ import annotations


# Official 50 khet of Bangkok (English transliteration used by ddproperty/hipflat).
BANGKOK_DISTRICTS: list[str] = [
    "Bang Bon", "Bang Kapi", "Bang Khae", "Bang Khen", "Bang Kho Laem",
    "Bang Khun Thian", "Bang Na", "Bang Phlat", "Bang Rak", "Bang Sue",
    "Bangkok Noi",
    "Bangkok Yai", "Bueng Kum", "Chatuchak", "Chom Thong", "Din Daeng",
    "Don Mueang", "Dusit", "Huai Khwang", "Khan Na Yao", "Khlong San",
    "Khlong Sam Wa", "Khlong Toei", "Lak Si", "Lat Krabang", "Lat Phrao",
    "Min Buri", "Nong Chok", "Nong Khaem", "Pathum Wan", "Phasi Charoen",
    "Phaya Thai", "Phra Khanong", "Phra Nakhon", "Pom Prap Sattru Phai",
    "Prawet", "Ratchathewi", "Rat Burana", "Sai Mai", "Samphanthawong",
    "Saphan Sung", "Sathon", "Suan Luang", "Taling Chan", "Thawi Watthana",
    "Thon Buri", "Thung Khru", "Vadhana", "Wang Thonglang", "Yan Nawa",
]

# Common neighbourhood / BTS-station / spelling aliases → canonical district.
DISTRICT_ALIASES: dict[str, str] = {
    "Sukhumvit": "Vadhana",
    "Watthana": "Vadhana",
    "Asoke": "Vadhana",
    "Asok": "Vadhana",
    "Thonglor": "Vadhana",
    "Thong Lo": "Vadhana",
    "Ekkamai": "Vadhana",
    "Phrom Phong": "Vadhana",
    "Nana": "Vadhana",
    "Sathorn": "Sathon",
    "Yannawa": "Yan Nawa",
    "Silom": "Bang Rak",
    "Sala Daeng": "Bang Rak",
    "Surasak": "Bang Rak",
    "Ari": "Phaya Thai",
    "Saphan Khwai": "Phaya Thai",
    "Rama 9": "Huai Khwang",
    "Rama IX": "Huai Khwang",
    "Phra Ram 9": "Huai Khwang",
    "Phra Ram IX": "Huai Khwang",
    "Ratchada": "Huai Khwang",
    "Ratchadaphisek": "Huai Khwang",
    "Phloen Chit": "Pathum Wan",
    "Ploenchit": "Pathum Wan",
    "Chitlom": "Pathum Wan",
    "Chit Lom": "Pathum Wan",
    "Siam": "Pathum Wan",
    "Lumpini": "Pathum Wan",
    "Victory Monument": "Ratchathewi",
    "Phaholyothin": "Phaya Thai",
    "On Nut": "Phra Khanong",
    "Bang Chak": "Phra Khanong",
    "Udom Suk": "Bang Na",
}


def extract_district(text: str | None) -> str | None:
    """Return canonical district found in `text`, or None.

    Matches the longest substring first to avoid 'Bang' (prefix) shadowing
    'Bang Rak'. Then falls back to alias lookup.
    """
    if not text:
        return None
    norm = text.lower()
    # Sort by descending length so multi-word names match before shorter ones
    for d in sorted(BANGKOK_DISTRICTS, key=len, reverse=True):
        if d.lower() in norm:
            return d
    for alias, canonical in sorted(DISTRICT_ALIASES.items(), key=lambda kv: -len(kv[0])):
        if alias.lower() in norm:
            return canonical
    return None
