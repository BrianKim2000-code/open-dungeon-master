import type { CharacterSheet } from "@/lib/schemas/sheet";
import type { MessageIntent } from "@/lib/dm/intent-logic";
import { findSpellByName } from "@/lib/content";
import { spellNames } from "@/lib/battlemap/hand-spells";
import { acknowledgesDrop, spellsNamedIn, type ConcentrationSwap } from "@/lib/dm/concentration-confirm-logic";

// The cast an action would make that ends the character's running
// concentration spell, or null (issue 252). Read before anything is posted
// (src/app/api/campaigns/[campaignId]/actions/route.ts): a card names its
// spell; a typed action is read for the character's own spells by name.
// Recasting the spell already held is not a swap (the cast guard keeps it
// running), and a typed action that already says the running spell goes
// needs no second question.
export function concentrationSwapFor(
  sheet: Pick<CharacterSheet, "id" | "concentratingOn" | "spellcasting">,
  action: { intent: MessageIntent | null; content: string; kind: string },
  authors: string[],
): ConcentrationSwap | null {
  const current = (sheet.concentratingOn ?? "").trim();
  if (!current || action.kind !== "do") {
    return null;
  }
  const concentrates = (name: string) => findSpellByName(name, authors)?.concentration === true;
  const same = (name: string) => name.trim().toLowerCase() === current.toLowerCase();
  if (action.intent) {
    const spell = action.intent.card === "spell" ? (action.intent.spell ?? "").trim() : "";
    return spell && !same(spell) && concentrates(spell) ? { characterId: sheet.id, current, next: spell } : null;
  }
  if (acknowledgesDrop(action.content, current)) {
    return null;
  }
  const named = spellsNamedIn(action.content, spellNames(sheet as CharacterSheet)).filter((name) => !same(name));
  const next = named.find(concentrates);
  return next ? { characterId: sheet.id, current, next } : null;
}
