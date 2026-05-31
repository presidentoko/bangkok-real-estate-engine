// web/lib/stations.test.ts
// Run with: node --test web/lib/stations.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { stationSlug, slugToDisplayName, buildStationIndex } from "./stations.ts";

test("stationSlug lowercases and hyphenates", () => {
  assert.equal(stationSlug("Phrom Phong"), "phrom-phong");
  assert.equal(stationSlug("Saint Louis"), "saint-louis");
  assert.equal(stationSlug("Phra Ram 9"), "phra-ram-9");
});

test("stationSlug strips punctuation and collapses separators", () => {
  assert.equal(stationSlug("Outer Ring Road-Ram Inthra"), "outer-ring-road-ram-inthra");
  assert.equal(stationSlug("Queen Sirikit National Convention Centre"),
    "queen-sirikit-national-convention-centre");
});

test("buildStationIndex maps slug back to a canonical display name", () => {
  const idx = buildStationIndex(["Phrom Phong", "Chit Lom", "On Nut"]);
  assert.equal(slugToDisplayName(idx, "phrom-phong"), "Phrom Phong");
  assert.equal(slugToDisplayName(idx, "on-nut"), "On Nut");
  assert.equal(slugToDisplayName(idx, "nonexistent"), null);
});

test("buildStationIndex dedupes names that share a slug", () => {
  const idx = buildStationIndex(["Phrom Phong", "phrom phong", "Phrom Phong"]);
  assert.equal(idx.size, 1);
  assert.equal(slugToDisplayName(idx, "phrom-phong"), "Phrom Phong");
});
