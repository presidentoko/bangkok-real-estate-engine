"""src/data/flood_polygons.py -- must agree with web/lib/floodLayer.server.ts."""
from src.data.flood_polygons import BOUNDARY_BUFFER_M, assign_district, distance_to_district_m, locate


def test_locate_landmarks():
    assert locate(13.7462, 100.5347) == "pathum-wan"   # Siam Paragon
    assert locate(13.9126, 100.6068) == "don-mueang"   # DMK terminal
    assert locate(13.3, 100.6) is None                 # Gulf of Thailand


def test_assign_rule():
    assert assign_district(13.7462, 100.5347, "Bang Rak") == "pathum-wan"
    assert assign_district(13.7462, 100.5347, "pathum-wan") == "pathum-wan"
    assert assign_district(None, None, "Bang Rak") == "bang-rak"
    assert assign_district(13.3, 100.6, "sathon") == "sathon"


def test_boundary_buffer():
    # Siam Paragon is far from Bang Rak, so a Bang Rak label is overridden...
    assert distance_to_district_m("bang-rak", 13.7462, 100.5347) > BOUNDARY_BUFFER_M
    # ...while a point on the Pathum Wan / Bang Rak line (Rama IV, Sam Yan) keeps either label.
    lat, lng = 13.7323, 100.5290
    assert min(distance_to_district_m("bang-rak", lat, lng),
               distance_to_district_m("pathum-wan", lat, lng)) <= BOUNDARY_BUFFER_M
    assert BOUNDARY_BUFFER_M == 75.0  # keep in step with web/lib/floodLayer.server.ts
