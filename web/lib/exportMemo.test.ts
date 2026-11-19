// Run with: node --test web/lib/exportMemo.test.ts   (Node >= 23, native TS strip)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeExportMemo } from "./exportMemo.ts";

test("disabled: always calls the loader (Vercel request-time rendering unchanged)", async () => {
  const memo = makeExportMemo({ enabled: false });
  let n = 0;
  await memo("k", () => ++n);
  await memo("k", () => ++n);
  assert.equal(n, 2);
});

test("enabled: second and third locale reuse the first read", async () => {
  const memo = makeExportMemo({ enabled: true });
  let n = 0;
  const load = async () => ({ data: [1, 2], error: null, n: ++n });
  const a = await memo("listings:1", load);
  const b = await memo("listings:1", load);
  const c = await memo("listings:1", load);
  assert.equal(n, 1);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test("concurrent renders share one in-flight read", async () => {
  const memo = makeExportMemo({ enabled: true });
  let n = 0;
  const load = async () => { n++; await new Promise((r) => setTimeout(r, 5)); return { data: 1, error: null }; };
  await Promise.all([memo("k", load), memo("k", load), memo("k", load)]);
  assert.equal(n, 1);
});

test("a failed read (error set) is not kept", async () => {
  const memo = makeExportMemo({ enabled: true });
  let n = 0;
  const load = async () => (++n === 1 ? { data: null, error: { code: "402" } } : { data: [1], error: null });
  const first = await memo("k", load);
  assert.ok(first.error);
  const second = await memo("k", load);
  assert.equal(n, 2);
  assert.deepEqual(second.data, [1]);
});

test("disk: a second process-less memo with the same dir reads the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "exportmemo-"));
  try {
    let n = 0;
    const load = async () => ({ data: ["x"], error: null, n: ++n });
    await makeExportMemo({ enabled: true, dir })("full:abc", load);
    const again = await makeExportMemo({ enabled: true, dir })("full:abc", load);
    assert.equal(n, 1);
    assert.deepEqual(again.data, ["x"]);
    assert.equal(readdirSync(dir).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("bounded: old entries are evicted", async () => {
  const memo = makeExportMemo({ enabled: true, maxEntries: 2 });
  let n = 0;
  const load = async () => ({ data: ++n, error: null });
  await memo("a", load); await memo("b", load); await memo("c", load);
  await memo("a", load);
  assert.equal(n, 4);
});
