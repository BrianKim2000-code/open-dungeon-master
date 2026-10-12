import type { TableLanguage } from "@/lib/schemas/game-settings";
import type { Campaign } from "@/lib/db/campaigns";
import type { CampaignMessage } from "@/lib/db/messages";
import { listLoreEntries } from "@/lib/db/lore";
import { listRuleChunks } from "@/lib/db/rules";
import { probeCustomContextWindow, storyContextTokens } from "@/lib/model-client";
import { renderLoreForPrompt, type WorldLoreEntry } from "@/lib/dm/world-lore-logic";
import { computeBudgets, promptWindowTokens } from "@/lib/dm/context-budget";
import { selectRuleChunks } from "@/lib/dm/rules-activation-logic";
import { renderHouseRules, renderVariantRules } from "@/lib/dm/rules-logic";
import { computeIdf, fuseRanked, lexicalScore } from "@/lib/dm/fusion-logic";

// Per-turn retrieval for the DM prompt: IDF-weighted lexical scoring over
// the enabled house-rule chunks and world-lore entries against the current
// moment (latest player messages + scene); only the most relevant few ride
// the prompt. Pinned items skip retrieval entirely.

const RULES_TOP = 3;
const LORE_TOP = 2;

export type TurnRetrieval = {
  variantRulesBlock: string;
  houseRulesBlock: string;
  loreBlock: string;
};

// The moment to retrieve against: the newest player messages this turn is
// answering, grounded by the current scene label.
function buildQuery(campaign: Campaign, history: CampaignMessage[]): string {
  const playerLines: string[] = [];
  for (let index = history.length - 1; index >= 0 && playerLines.length < 3; index -= 1) {
    const message = history[index];
    if (message.authorType === "player") {
      playerLines.unshift(message.content.slice(0, 400));
    } else if (message.authorType === "dm" && playerLines.length) {
      break;
    }
  }
  return [campaign.scene, ...playerLines].filter(Boolean).join("\n").slice(0, 1_200);
}

// Ranks one corpus and returns the picked entries in score order.
function pickFused<T>(
  entries: Array<{ id: string; text: string; value: T }>,
  query: string,
  limit: number,
  language: TableLanguage,
): T[] {
  if (!entries.length) {
    return [];
  }
  // IDF is computed over this corpus, so "dragon" is rare in a campaign that
  // never mentions dragons and unremarkable in one about nothing else.
  const idf = computeIdf(entries.map((entry) => entry.text), language);
  const byId = new Map(entries.map((entry) => [entry.id, entry.value]));
  const picked = fuseRanked(
    entries.map((entry) => ({
      id: entry.id,
      lexical: lexicalScore(query, entry.text, idf, language),
    })),
    { limit },
  );
  return picked
    .map((id) => byId.get(id))
    .filter((value): value is T => value !== undefined);
}

export async function buildTurnRetrieval(
  campaign: Campaign,
  history: CampaignMessage[],
  // What the turn's tool definitions cost, so the rules budget is a share of
  // the same window the prompt is packed against (issue #120).
  toolTokens = 0,
): Promise<TurnRetrieval> {
  // Resolved from the campaign's own provider and model rather than assuming
  // a default window, so the rules budget matches what the backend will
  // actually accept.
  // Ask the endpoint what window it was launched with before budgeting
  // against it. llama.cpp and llama-swap report their -c on /props; anything
  // else misses quietly and the configured or default value stands. Cached
  // per base URL, so this costs one request per process.
  if (campaign.settings.textProvider !== "local") {
    await probeCustomContextWindow(
      campaign.settings.customBaseUrl,
      campaign.settings.customApiKey,
      campaign.settings.customModel,
    );
  }
  const contextLimitTokens = promptWindowTokens(storyContextTokens(campaign.settings), toolTokens);
  const variantRulesBlock = renderVariantRules(campaign.gameSettings.variantRules);
  let houseRulesBlock = "";
  let loreBlock = "";
  try {
    const rules = listRuleChunks(campaign.id).filter((chunk) => chunk.enabled);
    const lore = listLoreEntries(campaign.id);
    if (rules.length || lore.length) {
      const query = buildQuery(campaign, history);

      // Pinned chunks and any whose trigger keyword appears in the query are
      // admitted outright; only what is left competes for the retrieval
      // slots. A small enough rules document rides whole and skips retrieval
      // (src/lib/dm/rules-activation-logic.ts).
      const activation = selectRuleChunks(
        rules,
        query,
        computeBudgets(contextLimitTokens).retrieval,
      );
      const forcedIds = new Set(activation.forced.map((chunk) => chunk.id));
      const pinnedRules = activation.forced;
      const retrievedRules = activation.verbatim
        ? []
        : pickFused(
            rules
              .filter((chunk) => !forcedIds.has(chunk.id))
              .map((chunk) => ({
                id: chunk.id,
                text: `${chunk.heading} ${chunk.text}`,
                value: chunk,
              })),
            query,
            RULES_TOP,
            campaign.gameSettings.tableLanguage,
          );
      houseRulesBlock = renderHouseRules(pinnedRules, retrievedRules);

      const pinnedLore = lore.filter((entry) => entry.pinned);
      const retrievedLore = pickFused(
        lore
          .filter((entry) => !entry.pinned)
          .map((entry) => ({
            id: entry.id,
            text: `${entry.title} ${entry.tags.join(" ")} ${entry.body}`,
            value: entry as WorldLoreEntry,
          })),
        query,
        LORE_TOP,
        campaign.gameSettings.tableLanguage,
      );
      loreBlock = renderLoreForPrompt(pinnedLore, retrievedLore);
    }
  } catch (error) {
    console.error("[context-retrieval] failed", error);
  }
  return { variantRulesBlock, houseRulesBlock, loreBlock };
}
