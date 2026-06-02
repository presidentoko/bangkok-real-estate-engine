// web/lib/condo-compact.test.ts
// Run with: node --test web/lib/condo-compact.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeCompact, decodeCompact, isCompact } from "./condo-compact.ts";
import type { CondoSummary } from "./queries/condos.ts";

function condo(over: Partial<CondoSummary>): CondoSummary {
  return {
    id: "x",
    name: "X",
    url: "https://example.com/x",
    latitude: null,
    longitude: null,
    region: null,
    province: "bangkok",
    hero_image_url: null,
    bubble_index: null,
    is_super_value: null,
    flood_risk_level: null,
    total_units: null,
    available_units_count: 7,
    market_sale_median: null,
    market_rent_median: null,
    market_summary_currency: null,
    property_type: "condo",
    source: "hipflat",
    ...over,
  };
}

test("roundtrip preserves the fields the grid + cards read", () => {
  const rows: CondoSummary[] = [
    condo({
      id: "a",
      name: "Alpha",
      region: "Sathon",
      latitude: 13.7,
      longitude: 100.5,
      hero_image_url: "https://cdn/x.jpg",
      bubble_index: 142,
      is_super_value: true,
      flood_risk_level: 3,
      total_units: 250,
      market_sale_median: 5_000_000,
      market_rent_median: 25_000,
      market_summary_currency: "THB",
      property_type: "apartment",
      source: "fazwaz",
    }),
    condo({ id: "b", name: "Beta" }),
  ];

  const decoded = decodeCompact(encodeCompact(rows));
  assert.equal(decoded.length, 2);

  // Preserved fields match exactly.
  const keep: (keyof CondoSummary)[] = [
    "id", "name", "region", "latitude", "longitude", "hero_image_url",
    "bubble_index", "is_super_value", "flood_risk_level", "total_units",
    "market_sale_median", "market_rent_median", "market_summary_currency",
    "property_type", "source",
  ];
  for (let i = 0; i < rows.length; i++) {
    for (const k of keep) {
      assert.deepEqual(decoded[i][k], rows[i][k], `${k} at row ${i}`);
    }
  }
});

test("intentionally-dropped fields decode to null/empty", () => {
  const [d] = decodeCompact(encodeCompact([condo({})]));
  assert.equal(d.url, null);
  assert.equal(d.available_units_count, null);
  assert.equal(d.province, "");
});

test("empty input is safe", () => {
  const c = encodeCompact([]);
  assert.equal(c.count, 0);
  assert.deepEqual(decodeCompact(c), []);
});

test("isCompact distinguishes new vs legacy payloads", () => {
  assert.equal(isCompact(encodeCompact([condo({})])), true);
  assert.equal(isCompact({ condos: [] }), false);
  assert.equal(isCompact(null), false);
  assert.equal(isCompact([]), false);
});
