// Per-die dice sources: how a stored preference map is read back, and how a
// single face resolves to manual typing or a server roll.
import assert from "node:assert/strict";
import { register } from "node:module";

register("./lib/register-alias.mjs", import.meta.url);

const {
  DIE_SIDES,
  defaultDiceSources,
  parseStored,
  resolveFaceSource,
} = await import("../src/lib/dice/dice-sources.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
}

// ---- the stored map ----

test("every die shape defaults to manual", () => {
  const map = defaultDiceSources();
  for (const sides of DIE_SIDES) {
    assert.equal(map[sides], "manual", `d${sides} should default to manual`);
  }
});

test("a stored map fills only the shapes it names", () => {
  const map = parseStored(JSON.stringify({ 20: "digital", 6: "manual" }));
  assert.equal(map[20], "digital");
  assert.equal(map[6], "manual");
  assert.equal(map[4], "manual");
  assert.equal(map[100], "manual");
});

test("junk in storage reads as the defaults rather than throwing", () => {
  const junk = parseStored("{not json");
  for (const sides of DIE_SIDES) {
    assert.equal(junk[sides], "manual");
  }
  const empty = parseStored("");
  assert.equal(empty[20], "manual");
});

test("a shape stored as something other than digital/manual falls back to manual", () => {
  const map = parseStored(JSON.stringify({ 20: 7, 6: "pixel:abc", 8: "digital" }));
  assert.equal(map[20], "manual");
  assert.equal(map[6], "manual");
  assert.equal(map[8], "digital");
});

// ---- face resolution ----

test("no preference or unknown preference means typing", () => {
  assert.deepEqual(resolveFaceSource(undefined), { kind: "manual" });
  assert.deepEqual(resolveFaceSource("manual"), { kind: "manual" });
  assert.deepEqual(resolveFaceSource("pixel:px-1"), { kind: "manual" });
});

test("a digital preference asks the server", () => {
  assert.deepEqual(resolveFaceSource("digital"), { kind: "digital" });
});

console.log(`dice-sources: ${passed} tests passed`);
