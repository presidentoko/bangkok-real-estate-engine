// web/lib/yieldAreas.test.ts
// Run with: node --test web/lib/yieldAreas.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areaKeys,
  buildYieldAreaIndex,
  computeAreaStats,
  quantile,
  type YieldAreaRow,
} from "./yieldAreas.ts";

function row(over: Partial<YieldAreaRow>): YieldAreaRow {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    slug: "some-condo",
    name: "Some Condo",
    province: "bangkok",
    region: "sathon",
    gross_yield_pct: 5,
    avg_sale_price: 4_000_000,
    avg_monthly_rent: 17_000,
    ...over,
  };
}

test("quantile interpolates between neighbours", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2);
  assert.equal(quantile([], 0.5), null);
});

test("area keys canonicalise province aliases", () => {
  assert.deepEqual(areaKeys(row({ province: "chiang-mai", region: "mueang-chiang-mai" })), {
    city: "chiangmai",
    district: "mueang-chiang-mai",
  });
});

test("the Chon Buri 'pattaya' region is Pattaya the city, not a Chon Buri district", () => {
  assert.deepEqual(areaKeys(row({ province: "chon-buri", region: "pattaya" })), {
    city: "pattaya",
    district: null,
  });
});

test("a district named like its own city is not a second page for the city", () => {
  assert.deepEqual(areaKeys(row({ province: "hua-hin", region: "hua-hin" })), {
    city: "huahin",
    district: null,
  });
});

test("stats: median, range, and top list ordered by yield", () => {
  const rows = [3, 4, 5, 6, 9].map((y, i) =>
    row({ id: String(i), gross_yield_pct: y, name: `C${y}` }),
  );
  const s = computeAreaStats(rows);
  assert.equal(s.count, 5);
  assert.equal(s.median, 5);
  assert.equal(s.p25, 4);
  assert.equal(s.p75, 6);
  assert.deepEqual(
    s.top.map((r) => r.name),
    ["C9", "C6", "C5", "C4", "C3"],
  );
});

test("price bands only report a median when a band has enough condos", () => {
  const rows = [
    ...[6, 7, 8].map((y) => row({ gross_yield_pct: y, avg_sale_price: 2_000_000 })),
    row({ gross_yield_pct: 4, avg_sale_price: 12_000_000 }),
  ];
  const bands = computeAreaStats(rows).bands;
  const under3 = bands.find((b) => b.key === "under3m")!;
  const over10 = bands.find((b) => b.key === "over10m")!;
  assert.equal(under3.count, 3);
  assert.equal(under3.median, 7);
  assert.equal(over10.count, 1);
  assert.equal(over10.median, null);
});

test("index keeps only areas at or above the threshold, districts inside their city", () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) => row({ id: `s${i}`, region: "sathon" })),
    ...Array.from({ length: 3 }, (_, i) => row({ id: `b${i}`, region: "bang-rak" })),
    ...Array.from({ length: 2 }, (_, i) => row({ id: `k${i}`, province: "krabi", region: "ao-nang" })),
  ];
  const index = buildYieldAreaIndex(rows, 8);
  assert.deepEqual(index.cities.map((c) => c.city), ["bangkok"]);
  assert.equal(index.cities[0].stats.count, 11);
  assert.deepEqual(index.cities[0].districts.map((d) => d.district), ["sathon"]);
  assert.equal(index.overall.count, 13);
});
