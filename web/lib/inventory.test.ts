// web/lib/inventory.test.ts
// Run with: node --test web/lib/inventory.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  median,
  mean,
  computeInventoryStats,
  availablePropertyTypes,
  topPicks,
  extractDistricts,
} from "./inventory.ts";
import type { CondoSummary } from "./queries/condos.ts";

function condo(over: Partial<CondoSummary>): CondoSummary {
  return {
    id: "x",
    slug: null,
    name: "X",
    url: null,
    latitude: null,
    longitude: null,
    region: null,
    province: "bangkok",
    hero_image_url: null,
    bubble_index: null,
    is_super_value: null,
    flood_risk_level: null,
    total_units: null,
    available_units_count: null,
    market_sale_median: null,
    market_rent_median: null,
    market_summary_currency: null,
    property_type: "condo",
    source: "hipflat",
    ...over,
  };
}

test("median / mean handle empty + odd/even", () => {
  assert.equal(median([]), null);
  assert.equal(mean([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(mean([2, 4, 6]), 4);
});

test("computeInventoryStats ignores nulls and non-positive prices", () => {
  const stats = computeInventoryStats([
    condo({ market_sale_median: 100, market_rent_median: 10, bubble_index: 80 }),
    condo({ market_sale_median: 300, market_rent_median: 30, bubble_index: 120 }),
    condo({ market_sale_median: 0, market_rent_median: null, bubble_index: null }),
  ]);
  assert.equal(stats.saleMedian, 200);
  assert.equal(stats.rentMedian, 20);
  assert.equal(stats.bubbleAvg, 100);
  assert.equal(stats.bubbleSampleSize, 2);
});

test("computeInventoryStats counts super-value, geo-located, currency", () => {
  const stats = computeInventoryStats([
    condo({ is_super_value: true, latitude: 1, longitude: 2 }),
    condo({ is_super_value: false, latitude: null }),
  ]);
  assert.equal(stats.superValue, 1);
  assert.equal(stats.geoLocated, 1);
  assert.equal(computeInventoryStats([condo({})]).currency, "THB");
  assert.equal(
    computeInventoryStats([condo({ market_summary_currency: "USD" })]).currency,
    "USD"
  );
});

test("availablePropertyTypes returns only present types in canonical order", () => {
  assert.deepEqual(
    availablePropertyTypes([
      condo({ property_type: "apartment" }),
      condo({ property_type: "condo" }),
    ]),
    ["condo", "apartment"]
  );
});

test("topPicks: super-value-with-photo, cheapest bubble first, capped", () => {
  const picks = topPicks(
    [
      condo({ id: "a", is_super_value: true, hero_image_url: "p", bubble_index: 90 }),
      condo({ id: "b", is_super_value: true, hero_image_url: "p", bubble_index: 70 }),
      condo({ id: "c", is_super_value: true, hero_image_url: null, bubble_index: 60 }),
      condo({ id: "d", is_super_value: false, hero_image_url: "p", bubble_index: 50 }),
    ],
    2
  );
  assert.deepEqual(picks.map((c) => c.id), ["b", "a"]);
});

test("extractDistricts collapses variants and prefers capitalised label", () => {
  assert.deepEqual(
    extractDistricts([
      condo({ region: "watthana" }),
      condo({ region: "Watthana" }),
      condo({ region: "Bang Rak" }),
      condo({ region: null }),
    ]),
    ["Bang Rak", "Watthana"]
  );
});
