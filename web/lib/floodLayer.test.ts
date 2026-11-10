// web/lib/floodLayer.test.ts
// Run with: node --test web/lib/floodLayer.test.ts   (from web/; Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFloodLayer } from "./floodLayer.server.ts";
import { FLOOD_DISTRICTS, findFloodDistrict } from "./floodDistricts.ts";

test("every layer polygon resolves to a FLOOD_DISTRICTS row at the same level", () => {
  const layer = loadFloodLayer(); // throws on any name/level mismatch
  assert.equal(layer.features.length, 50);
  assert.equal(FLOOD_DISTRICTS.length, 50);
});

test("regions.name slugs for the renamed khet resolve (the old /flood table missed them)", () => {
  // The DB stores the layer's spelling as a slug; the table printed the
  // display name and joined on it, so these two read 0 condos.
  assert.equal(findFloodDistrict("vadhana")?.slug, "vadhana");
  assert.equal(findFloodDistrict("sathon")?.slug, "sathon");
  assert.equal(findFloodDistrict("Watthana")?.slug, "vadhana");
  assert.equal(findFloodDistrict("Sathorn")?.slug, "sathon");
});

test("locate() puts known landmarks in the right khet", () => {
  const { locate } = loadFloodLayer();
  // Siam Paragon
  assert.equal(locate(13.7462, 100.5347)?.slug, "pathum-wan");
  // Don Mueang Airport terminal
  assert.equal(locate(13.9126, 100.6068)?.slug, "don-mueang");
  // Sala Daeng BTS / Silom is Bang Rak
  assert.equal(locate(13.7287, 100.5343)?.slug, "bang-rak");
  // Gulf of Thailand -- outside every polygon
  assert.equal(locate(13.3, 100.6), null);
});

test("assign() keeps the stored khet only on a boundary, else trusts the polygon", () => {
  const { assign } = loadFloodLayer();
  // Siam Paragon stored under Bang Rak (well over 75 m from it) -> Pathum Wan.
  assert.equal(assign(13.7462, 100.5347, "bang-rak")?.slug, "pathum-wan");
  // Stored = polygon -> unchanged.
  assert.equal(assign(13.7462, 100.5347, "pathum-wan")?.slug, "pathum-wan");
  // No coordinates -> the stored district, resolved through aliases.
  assert.equal(assign(null, null, "Watthana")?.slug, "vadhana");
  // Outside every polygon -> the stored district.
  assert.equal(assign(13.3, 100.6, "sathon")?.slug, "sathon");
});
