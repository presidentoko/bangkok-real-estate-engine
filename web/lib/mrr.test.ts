// web/lib/mrr.test.ts
// Run with: node --test web/lib/mrr.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mrrLabel, mrrMonth } from "./mrr.ts";

test("the MRR always carries its as-of month (audit H4)", () => {
  assert.equal(mrrLabel(7.1, "2025-07-01", "en"), "7.10% (as of Jul 2025)");
  assert.equal(mrrLabel(7.1, "2025-07-01", "ko"), "7.10% (2025년 7월 기준)");
  assert.equal(mrrLabel(7.1, "2025-07-01", "th"), "7.10% (ณ ก.ค. 2025)");
});

test("a missing or malformed period prints the rate alone, never a guessed date", () => {
  assert.equal(mrrLabel(7.1, null), "7.10%");
  assert.equal(mrrLabel(7.1, "2025-13-01"), "7.10%");
  assert.equal(mrrMonth("garbage"), null);
});
