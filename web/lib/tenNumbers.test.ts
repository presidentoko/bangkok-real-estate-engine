// web/lib/tenNumbers.test.ts
// Run with: node --test web/lib/tenNumbers.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEN_NUMBERS } from "./tenNumbers.ts";

const langs = Object.keys(TEN_NUMBERS) as Array<keyof typeof TEN_NUMBERS>;

/** Every number token in a string: "1,296", "5.4", "4.3–6.5" -> ["4.3", "6.5"]. */
const numbers = (s: string): string[] => (s.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).sort();

test("ten findings in every language", () => {
  for (const l of langs) assert.equal(TEN_NUMBERS[l].findings.length, 10, l);
});

/** Every number in the English text also appears in the translation (as a
 *  multiset). A translation may add numerals the English spells out ("four
 *  portals" -> "4개 포털", "July 2025" -> "2025년 7월"), so this is a subset
 *  check, not equality; it still catches a dropped or mistyped figure. */
function assertCarriesNumbers(translated: string, english: string, label: string) {
  const pool = numbers(translated);
  for (const n of numbers(english)) {
    const at = pool.indexOf(n);
    assert.ok(at >= 0, `${label}: ${n} missing from "${translated}"`);
    pool.splice(at, 1);
  }
}

test("translations carry the same figures, samples and links as English", () => {
  const en = TEN_NUMBERS.en.findings;
  for (const l of langs) {
    TEN_NUMBERS[l].findings.forEach((f, i) => {
      assert.equal(f.figure, en[i].figure, `${l} #${i + 1} figure`);
      assert.equal(f.link, en[i].link, `${l} #${i + 1} link`);
      assertCarriesNumbers(f.sample, en[i].sample, `${l} #${i + 1} sample`);
      assertCarriesNumbers(f.body, en[i].body, `${l} #${i + 1} body`);
    });
    assertCarriesNumbers(TEN_NUMBERS[l].method.join(" "), TEN_NUMBERS.en.method.join(" "), `${l} method`);
  }
});

test("headline figures match the 2026-11-17 re-verification", () => {
  const figs = TEN_NUMBERS.en.findings.map((f) => f.figure);
  assert.deepEqual(figs, [
    "6.2% vs 4.2%", "23%", "5.4%", "+45%", "2x", "24%", "~4,800", "6.3% → 4.1%", "4.6x", "5.4% vs 8.5%",
  ]);
});
