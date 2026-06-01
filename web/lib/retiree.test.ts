// web/lib/retiree.test.ts
// Run with: node --test web/lib/retiree.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { retireeSuitability } from "./retiree.ts";

test("returns null without the core healthcare signal", () => {
  const r = retireeSuitability({
    hospitalsWithin1km: null,
    aqiScore: 40,
    supermarketsWithin1km: 3,
    nearestTransitM: 200,
  });
  assert.equal(r, null);
});

test("excellent: hospitals, clean air, on transit, errands", () => {
  const r = retireeSuitability({
    hospitalsWithin1km: 4,
    aqiScore: 20,
    supermarketsWithin1km: 3,
    nearestTransitM: 250,
  });
  assert.ok(r);
  assert.equal(r!.grade, "excellent");
  assert.ok(r!.score >= 90, `expected >=90, got ${r!.score}`);
  assert.equal(r!.confidence, "ok");
});

test("weak: no healthcare, foul air, far from transit", () => {
  const r = retireeSuitability({
    hospitalsWithin1km: 0,
    aqiScore: 180,
    supermarketsWithin1km: 0,
    nearestTransitM: 2000,
  });
  assert.ok(r);
  assert.equal(r!.grade, "weak");
  assert.ok(r!.score < 35, `expected <35, got ${r!.score}`);
});

test("missing AQI renormalises weights (no zero-drag) and flags low confidence", () => {
  const withAir = retireeSuitability({
    hospitalsWithin1km: 3,
    aqiScore: 20,
    supermarketsWithin1km: 2,
    nearestTransitM: 400,
  })!;
  const noAir = retireeSuitability({
    hospitalsWithin1km: 3,
    aqiScore: null,
    supermarketsWithin1km: 2,
    nearestTransitM: 400,
  })!;
  assert.equal(noAir.confidence, "low");
  assert.equal(withAir.confidence, "ok");
  // Dropping a clean-air bonus should not crater the score to near-zero; the
  // renormalised score stays close to the healthcare/transit/errands blend.
  assert.ok(noAir.score >= 70, `expected renormalised >=70, got ${noAir.score}`);
});

test("lower AQI scores strictly better, all else equal", () => {
  const base = {
    hospitalsWithin1km: 2,
    supermarketsWithin1km: 2,
    nearestTransitM: 600,
  };
  const clean = retireeSuitability({ ...base, aqiScore: 20 })!;
  const dirty = retireeSuitability({ ...base, aqiScore: 160 })!;
  assert.ok(clean.score > dirty.score);
});

test("clamps to 0..100 and rounds to one decimal", () => {
  const r = retireeSuitability({
    hospitalsWithin1km: 5,
    aqiScore: 10,
    supermarketsWithin1km: 9,
    nearestTransitM: 100,
  })!;
  assert.ok(r.score <= 100);
  assert.equal(Math.round(r.score * 10) / 10, r.score);
});
