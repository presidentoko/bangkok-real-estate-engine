// Run with: node --test web/lib/condoIndexability.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasIndexableSubstance,
  hasIndexableSubstanceWithoutDescription,
} from "./condoIndexability.ts";

const LONG = "x".repeat(130);
const base = { active_listings_count: 0, market_sale_median: null, market_rent_median: null, gross_yield_pct: null };

test("the description-free check is exactly the four non-description signals", () => {
  assert.equal(hasIndexableSubstanceWithoutDescription(base), false);
  assert.equal(hasIndexableSubstanceWithoutDescription({ ...base, active_listings_count: 1 }), true);
  assert.equal(hasIndexableSubstanceWithoutDescription({ ...base, market_sale_median: 1 }), true);
  assert.equal(hasIndexableSubstanceWithoutDescription({ ...base, market_rent_median: 1 }), true);
  assert.equal(hasIndexableSubstanceWithoutDescription({ ...base, gross_yield_pct: 4 }), true);
  assert.equal(hasIndexableSubstanceWithoutDescription(null), false);
});

test("sitemap shortcut agrees with the real predicate for every combination", () => {
  // The sitemap skips downloading `description` for rows the cheap check
  // passes. That is only safe if the cheap check implies the full predicate,
  // and if the full predicate == cheap || long description.
  for (const listings of [0, 1]) for (const sale of [null, 1]) for (const rent of [null, 1])
    for (const yld of [null, 3]) for (const desc of [null, "", "short", LONG]) {
      const row = { active_listings_count: listings, market_sale_median: sale, market_rent_median: rent, gross_yield_pct: yld, description: desc };
      const cheap = hasIndexableSubstanceWithoutDescription(row);
      const full = hasIndexableSubstance(row);
      if (cheap) assert.equal(full, true);
      assert.equal(full, cheap || (desc ?? "").trim().length >= 120);
    }
});
