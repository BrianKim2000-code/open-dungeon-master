import { campaignLanguage } from "@/lib/db/campaigns";
import { listActiveFacts } from "@/lib/db/facts";
import { computeIdf, fuseRanked, lexicalScore } from "@/lib/dm/fusion-logic";
import { chunkScenes, type ChunkableMessage } from "@/lib/dm/scene-logic";
import { renderFactsOnFile, type ShownFact } from "@/lib/dm/fact-consolidation-logic";

// The facts on file an extraction call is handed (chapter close, history
// compaction; src/lib/dm/fact-consolidation-logic.ts), nearest to the
// passage it summarizes first: those are the ones its new facts may repeat,
// update or contradict. Ranked by the same lexical scoring as retrieval,
// each fact's words against the passage's, with no cut-off; the rest follow
// newest first, and the fact sheet's budget decides how many are shown.
export async function factsOnFileFor(
  campaignId: string,
  messages: ChunkableMessage[],
): Promise<{ text: string; shown: ShownFact[] }> {
  const facts = listActiveFacts(campaignId);
  if (!facts.length) {
    return { text: "", shown: [] };
  }
  const pieces = chunkScenes(messages).map((scene) => scene.text);
  const passage = pieces.join("\n\n");
  const haystack = (fact: (typeof facts)[number]) => `${fact.subject} ${fact.fact}`;
  const language = campaignLanguage(campaignId);
  const idf = computeIdf(facts.map(haystack), language);
  const ranked = fuseRanked(
    facts.map((fact) => ({
      id: fact.id,
      lexical: lexicalScore(passage, haystack(fact), idf, language),
    })),
    { limit: facts.length },
  );
  // A stable sort: the unranked keep their newest-first order behind the
  // ranked ones.
  const position = new Map(ranked.map((id, at) => [id, at]));
  return renderFactsOnFile(
    facts.slice().sort((a, b) => (position.get(a.id) ?? ranked.length) - (position.get(b.id) ?? ranked.length)),
  );
}
