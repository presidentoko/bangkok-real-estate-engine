// web/lib/doohong.test.ts
// Run with: node --test web/lib/doohong.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { doohongBuildingLink, doohongHomeUrl, doohongSlugFor, slugifyName } from "./doohong.ts";

const UTM = "?utm_source=passionaryestate&utm_medium=building_page";

test("slugifyName matches scripts/backfill_condo_slug.py", () => {
  assert.equal(slugifyName("LIFE Sathorn - Narathiwas 22"), "life-sathorn-narathiwas-22");
  assert.equal(slugifyName("  The Address  Siam-Ratchathewi "), "the-address-siam-ratchathewi");
  assert.equal(slugifyName("ไลฟ์ สาทร"), "");
  assert.equal(slugifyName(null), "");
});

test("a building DooHong has links to its page in each locale", () => {
  assert.deepEqual(doohongBuildingLink("Life Sathorn Sierra", "bangkok", "en"), {
    href: `https://doohong.com/en/condo/life-sathorn-sierra${UTM}`,
    matched: true,
  });
  assert.equal(
    doohongBuildingLink("Life Sathorn Sierra", "bangkok", "ko").href,
    `https://doohong.com/ko/condo/life-sathorn-sierra${UTM}`,
  );
  assert.equal(
    doohongBuildingLink("Life Sathorn Sierra", "bangkok", "th").href,
    `https://doohong.com/condo/life-sathorn-sierra${UTM}`,
  );
});

test("other buildings link to DooHong's home in the same language", () => {
  assert.deepEqual(doohongBuildingLink("No Such Tower", "bangkok", "th"), {
    href: `https://doohong.com/${UTM}`,
    matched: false,
  });
  assert.equal(doohongBuildingLink("No Such Tower", "bangkok", "en").href, `https://doohong.com/en${UTM}`);
  assert.equal(doohongBuildingLink("No Such Tower", "bangkok", "ko").href, `https://doohong.com/ko${UTM}`);
});

test("a same-named building outside greater Bangkok is not matched", () => {
  assert.equal(doohongSlugFor("Life Sathorn Sierra", "phuket"), null);
  assert.equal(doohongSlugFor("Aspire Rattanathibet Weston", "nonthaburi"), "aspire-rattanathibet-weston");
  assert.equal(doohongSlugFor("Life Sathorn Sierra", null), "life-sathorn-sierra");
});

test("footer and about links carry their own utm_medium", () => {
  assert.equal(doohongHomeUrl("en", "footer"), "https://doohong.com/en?utm_source=passionaryestate&utm_medium=footer");
  assert.equal(doohongHomeUrl("th", "about"), "https://doohong.com/?utm_source=passionaryestate&utm_medium=about");
});
