// web/lib/activeListings.test.ts
// Run with: node --test web/lib/activeListings.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeListingsOrFilter, HIPFLAT_ACTIVE_DAYS } from "./activeListings.ts";

test("hipflat rows older than the window are left out of active counts", () => {
  assert.equal(HIPFLAT_ACTIVE_DAYS, 30);
  assert.equal(
    activeListingsOrFilter(new Date("2026-11-17T04:00:00Z")),
    "source.neq.hipflat,last_seen_at.gte.2026-10-18T00:00:00Z",
  );
});

test("the cutoff is stable within a day", () => {
  assert.equal(
    activeListingsOrFilter(new Date("2026-11-17T00:00:01Z")),
    activeListingsOrFilter(new Date("2026-11-17T23:59:59Z")),
  );
});
