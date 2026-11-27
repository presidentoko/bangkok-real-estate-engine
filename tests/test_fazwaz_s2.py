"""FazWaz search cards, "s2" layout (live 2026-11). Trimmed from a real card."""
from src.scrapers.fazwaz import parse_cards

CARD = """
<article class="s2-card s2-near" data-id="6171845" data-type="unit"
  data-m='{"a":27.5,"f":22,"o":[1],"b":1,"p":3075000}'>
 <a class="s2-ph" href="https://www.fazwaz.com/property-sales/x-u6171845"><img src="https://cdn.fazwaz.com/t.jpg"></a>
 <div class="s2-b">
  <a class="s2-price" href="https://www.fazwaz.com/property-sales/x-u6171845">
   <span class="lm-p1"><b>฿3,075,000</b><s>฿3,600,000</s></span></a>
  <h3 class="s2-ttl3"><a class="s2-spec-a">
   <span class="s2-fact s2i-bed">1</span><span class="s2-fact s2i-bath">1</span>
   <span class="s2-fact s2i-size">27.51 SqM</span><span class="s2-fact s2i-condo">Condo</span></a></h3>
  <p class="s2-pname"><a href="https://www.fazwaz.com/projects/thailand/bangkok/phra-khanong/bang-chak/the-line-sukhumvit-101">The Line Sukhumvit 101</a></p>
  <p class="s2-where">Bang Chak, Phra Khanong, Bangkok</p>
  <p class="s2-place s2i-dist">320 m to Punnawithi BTS</p>
  <div class="s2-pills"><span class="tag">Foreign Quota</span><span class="tag">Floor 22</span><span class="tag">Built: 2020</span></div>
 </div>
 <div class="s2-more"><dl>
  <div><dt>Costs</dt><dd><span>CAM fee ฿1,788/mo</span></dd></div>
  <div><dt>Return</dt><dd><span>est. 5% yield</span><span>&nbsp;·&nbsp;rent ≈฿13,600/mo</span></dd></div>
 </dl></div>
</article>
<article class="s2-card" data-id="6171845" data-m='{"p":1}'></article>
<article class="s2-card" data-id="999" data-m='{"a":30,"b":1,"p":2000000}'>
 <p class="s2-where">Nong Prue, Bang Lamung, Chonburi</p>
 <p class="s2-place">1.2 km to Some Beach</p>
</article>
"""


def test_s2_card_fields():
    items = parse_cards(CARD)
    # duplicate data-id skipped; the third card has no project name -> dropped
    assert len(items) == 1
    it = items[0]
    assert it["source_listing_id"] == "6171845"
    assert it["name"] == "The Line Sukhumvit 101"
    assert it["price"] == 3075000
    assert it["area_sqm"] == 27.5
    assert it["price_per_sqm"] == round(3075000 / 27.5, 2)
    assert (it["bedrooms"], it["bathrooms"]) == (1, 1)
    assert it["property_type"] == "Condo"
    assert (it["subdistrict"], it["district"], it["province"]) == ("Bang Chak", "Phra Khanong", "Bangkok")
    assert it["project_url"].endswith("/the-line-sukhumvit-101")
    assert it["url"].endswith("-u6171845")
    assert it["transit"] == [{"label": "BTS", "station": "Punnawithi", "distance_km": 0.32}]
    assert it["year_built"] == 2020
    assert it["ownership"] == "Foreign Quota"
    assert it["cam_fee_per_month"] == 1788
    assert it["est_rent_per_month"] == 13600
    assert it["provided_yield_pct"] == 5
    assert it["thumbnail"] == "https://cdn.fazwaz.com/t.jpg"


def test_s2_km_distance_and_non_transit():
    html = CARD.replace('<p class="s2-where">Nong', '<p class="s2-pname"><a href="/projects/x">X</a></p><p class="s2-where">Nong')
    items = {i["source_listing_id"]: i for i in parse_cards(html)}
    t = items["999"]["transit"]
    assert t == [{"label": None, "station": "Some Beach", "distance_km": 1.2}]
    assert items["999"]["project_url"] == "https://www.fazwaz.com/projects/x"


def test_legacy_layout_still_empty_safe():
    assert parse_cards("<html><body>nothing</body></html>") == []
