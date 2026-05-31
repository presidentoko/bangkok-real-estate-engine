// web/lib/cities.test.ts
// Run with: node --test web/lib/cities.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCity, canonicalCitySlug, cityProvinceSlugs } from "./cities.ts";

test("getCity resolves the canonical compact slug", () => {
  assert.equal(getCity("chiangmai")?.slug, "chiangmai");
  assert.equal(getCity("samui")?.slug, "samui");
});

test("getCity also resolves kebab / DB-province aliases (the hardening)", () => {
  assert.equal(getCity("chiang-mai")?.slug, "chiangmai");
  assert.equal(getCity("ko-samui")?.slug, "samui");
  assert.equal(getCity("hua-hin")?.slug, "huahin");
  assert.equal(getCity("chon-buri")?.slug, "chonburi");
  assert.equal(getCity("chiang-rai")?.slug, "chiangrai");
  assert.equal(getCity("surat-thani")?.slug, "samui");
});

test("getCity returns null for bangkok (handled separately) and unknown slugs", () => {
  assert.equal(getCity("bangkok"), null);
  assert.equal(getCity("atlantis"), null);
});

test("canonicalCitySlug round-trips both slug forms to the UI slug", () => {
  assert.equal(canonicalCitySlug("chiang-mai"), "chiangmai");
  assert.equal(canonicalCitySlug("chiangmai"), "chiangmai");
  assert.equal(canonicalCitySlug(null), "bangkok");
});

test("cityProvinceSlugs returns every DB variant for the IN clause", () => {
  assert.deepEqual(cityProvinceSlugs("chiangmai"), ["chiangmai", "chiang-mai"]);
  assert.deepEqual(cityProvinceSlugs("phuket"), ["phuket"]);
});
