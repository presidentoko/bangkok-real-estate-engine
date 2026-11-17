// web/lib/bubble.test.ts
// Run with: node --test web/lib/bubble.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { bubbleBand, BUBBLE_OVERPRICED, BUBBLE_UNDERPRICED } from "./bubble.ts";
import { gradeFromBubble, gradeFromFlood } from "./grading.ts";

test("one set of bands: <80 underpriced, >130 bubble suspect (audit M11)", () => {
  assert.equal(BUBBLE_UNDERPRICED, 80);
  assert.equal(BUBBLE_OVERPRICED, 130);
  assert.equal(bubbleBand(79.9), "under");
  assert.equal(bubbleBand(80), "market");
  assert.equal(bubbleBand(130), "market");
  assert.equal(bubbleBand(130.1), "over");
  assert.equal(bubbleBand(null), null);
});

test("report card grades follow the same bands", () => {
  assert.equal(gradeFromBubble(79), "A");
  assert.equal(gradeFromBubble(85), "B");
  assert.equal(gradeFromBubble(131), "F");
  assert.equal(gradeFromBubble(null), "?");
});

test("a missing flood level is unknown, never a grade (audit M8)", () => {
  assert.equal(gradeFromFlood(null), "?");
  assert.equal(gradeFromFlood(1), "A");
  assert.equal(gradeFromFlood(5), "F");
});
