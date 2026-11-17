// web/lib/fmt.test.ts
// Run with: node --test web/lib/fmt.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtListingCompact, fmtListingPerSqm } from "./fmt.ts";

test("USD listings keep a dollar sign, never a baht sign (audit H3)", () => {
  assert.equal(fmtListingCompact(62_849, "USD"), "$63K");
  assert.equal(fmtListingPerSqm(1_964, "USD"), "$1,964");
  assert.equal(fmtListingCompact(1_250_000, "usd"), "$1.25M");
});

test("THB and missing currency format as baht", () => {
  assert.equal(fmtListingCompact(2_100_000, "THB"), "฿2.10M");
  assert.equal(fmtListingCompact(18_000, null), "฿18K");
  assert.equal(fmtListingPerSqm(65_000, "THB"), "฿65,000");
});

test("unknown currency or missing value prints a dash, not a guess", () => {
  assert.equal(fmtListingCompact(100, "EUR"), "—");
  assert.equal(fmtListingPerSqm(100, "EUR"), "—");
  assert.equal(fmtListingCompact(null, "USD"), "—");
});
