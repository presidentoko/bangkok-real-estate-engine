// web/lib/ownListingMedians.test.ts
// Run with: node --test web/lib/ownListingMedians.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtOwnMoney, ownMedian } from "./ownListingMedians.ts";

const sale = (price: number, area: number, currency = "USD") => ({
  listing_type: "sale", price, price_per_sqm: price / area, currency, area_sqm: area, is_active: true,
});

test("the building's own sale median, not the area summary (audit H9)", () => {
  const rows = [sale(59_000, 30), sale(62_849, 32), sale(70_000, 33), sale(86_000, 40)];
  const m = ownMedian(rows, "sale")!;
  assert.equal(m.currency, "USD");
  assert.equal(m.n, 4);
  assert.equal(Math.round(m.median), 66_425);
  assert.ok(m.perSqm! > 1_900 && m.perSqm! < 2_200);
  assert.equal(fmtOwnMoney(2_100.4, "USD"), "$2,100");
});

test("fewer than 3 usable listings gives no figure", () => {
  assert.equal(ownMedian([sale(60_000, 30), sale(61_000, 31)], "sale"), null);
});

test("implausible rows are ignored: sqft areas, baht tagged USD, inactive", () => {
  const rows = [
    sale(2_070_207, 587), // sqft area, baht tagged USD
    { listing_type: "rent", price: 9_001, currency: "USD", area_sqm: null, is_active: true },
    { ...sale(60_000, 30), is_active: false },
    sale(60_000, 30), sale(61_000, 31),
  ];
  assert.equal(ownMedian(rows, "sale"), null);
  assert.equal(ownMedian(rows, "rent"), null);
});
