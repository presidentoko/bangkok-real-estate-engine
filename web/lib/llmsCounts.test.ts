// Run with: node --test web/lib/llmsCounts.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { requireCount, roundEstimate } from "./llmsCounts.ts";

test("returns a good count", () => {
  assert.equal(requireCount({ count: 1894 }, "buildings", 1), 1894);
  assert.equal(requireCount({ count: 0 }, "yields"), 0);
});

test("a failed or missing count throws instead of becoming 0", () => {
  assert.throws(() => requireCount({ count: null, error: { code: "57014" } }, "listings"));
  assert.throws(() => requireCount({ count: null }, "listings"));
  assert.throws(() => requireCount({ count: 0 }, "buildings", 1));
  assert.throws(() => requireCount({ count: -1 }, "listings", 1));
});

test("estimates round to the nearest hundred", () => {
  assert.equal(roundEstimate(66441), 66400);
  assert.equal(roundEstimate(66450), 66500);
});
