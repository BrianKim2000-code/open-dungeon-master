// The DM's assist rail: what a player said turned into a shortlist of
// adjudications ranked by shared words (each entry with the SRD text of the
// choices it offers), and what the model proposed read back.
// The ranking reads only caller-supplied scores; the scoring and the model
// are exercised against fakes in test-table-language-calls.mjs.
import assert from "node:assert/strict";
import { register } from "node:module";

register("./lib/register-alias.mjs", import.meta.url);

const { availableEntries, candidateLine, catalogEntryText, catalogPassages, parseSuggestionJson, rankByScore, srdSections } =
  await import("../src/lib/dm/assist-logic.ts");
const { ADJUDICATIONS } = await import("../src/lib/dm/invoke-catalog.ts");
const { rulebookPages } = await import("../src/lib/rulebook/book.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
}

test("an entry is matched on its name in words, its label and its summary", () => {
  const attack = ADJUDICATIONS.find((entry) => entry.name === "pc_attack");
  const text = catalogEntryText(attack);
  assert.ok(text.startsWith("pc attack: "));
  assert.ok(text.includes(attack.label) && text.includes(attack.summary));
});

test("an entry also carries the SRD's text for each choice it offers, and only what the SRD titles that way", () => {
  const sections = srdSections(rulebookPages());
  // A run-in paragraph and a heading both count, as plain text.
  assert.match(sections.get("athletics"), /^Athletics\. Your Strength \(Athletics\) check covers .*climb/);
  assert.match(sections.get("poisoned"), /poisoned creature has disadvantage on attack rolls/i);
  assert.ok([...sections.values()].every((text) => text.length <= 1200 && !/[*#]/.test(text)));
  const roll = catalogPassages(ADJUDICATIONS.find((entry) => entry.name === "request_roll"), sections);
  assert.equal(roll[0], catalogEntryText(ADJUDICATIONS.find((entry) => entry.name === "request_roll")));
  assert.ok(roll.some((passage) => passage.startsWith("Ask for a roll: Athletics. Athletics. Your Strength")));
  assert.ok(roll.some((passage) => passage.startsWith("Ask for a roll: Stealth. ")));
  // An entry whose choices the SRD does not title has its own text alone.
  const gold = ADJUDICATIONS.find((entry) => entry.name === "modify_gold");
  assert.deepEqual(catalogPassages(gold, sections), [catalogEntryText(gold)]);
});

test("the model sees each action's arguments, a pick list with its values, so a prefill is one the form offers", () => {
  const roll = candidateLine(ADJUDICATIONS.find((entry) => entry.name === "request_roll"));
  assert.ok(roll.startsWith("- request_roll: "));
  assert.match(roll, /skill \(select: acrobatics\|animal_handling\|[^)]*athletics[^)]*\)/);
  assert.match(roll, /arguments: characterId \(character\), kind \(select, required: skill_check\|/);
  // A pick list that also takes a typed value says so.
  const typed = ADJUDICATIONS.flatMap((entry) => entry.fields.filter((field) => field.options?.length && field.other).map(() => entry))[0];
  if (typed) {
    assert.match(candidateLine(typed), /\|other text\)/);
  }
  const gold = candidateLine(ADJUDICATIONS.find((entry) => entry.name === "modify_gold"));
  assert.ok(!gold.includes("select"));
});

test("fight tools are not offered when there is no fight", () => {
  const combatOnly = ADJUDICATIONS.filter((entry) => entry.needsEncounter);
  assert.ok(combatOnly.length > 0, "the catalog has no encounter-gated entries");
  const calm = availableEntries(ADJUDICATIONS, false);
  assert.ok(calm.every((entry) => !entry.needsEncounter));
  assert.equal(availableEntries(ADJUDICATIONS, true).length, ADJUDICATIONS.length);
});

test("the highest-scored entries come first, the list stays short, and ties keep catalog order", () => {
  const [a, b, c, d] = ADJUDICATIONS;
  const scores = new Map([
    [a.name, 0.9],
    [b.name, 0.4],
    [c.name, 0.4],
    [d.name, 0.55],
  ]);
  const ranked = rankByScore([a, b, c, d], (entry) => scores.get(entry.name) ?? 0, 3).map((entry) => entry.name);
  assert.deepEqual(ranked, [a.name, d.name, b.name]);
  // An entry with no score is never ranked.
  assert.deepEqual(rankByScore([a, b], (entry) => (entry === a ? 0.2 : 0), 5).map((entry) => entry.name), [a.name]);
});

test("a model's JSON pick is read, fences and all", () => {
  const parsed = parseSuggestionJson(
    'Sure!\n```json\n{"name": "request_roll", "args": {"kind": "skill_check"}, "why": "to spot the trap"}\n```',
  );
  assert.equal(parsed.name, "request_roll");
  assert.deepEqual(parsed.args, { kind: "skill_check" });
  assert.equal(parsed.why, "to spot the trap");
});

test("unusable JSON is null, because the shortlist is already on screen", () => {
  assert.equal(parseSuggestionJson("no json here"), null);
  assert.equal(parseSuggestionJson('{"args": {}}'), null);
  assert.equal(parseSuggestionJson('{"name": "x", "args": [1,2]}').args !== null, true);
  assert.deepEqual(parseSuggestionJson('{"name": "x", "args": [1,2]}').args, {});
});

console.log(`assist: ${passed} tests passed`);
