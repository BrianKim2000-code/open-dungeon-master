import { campaignLanguage } from "@/lib/db/campaigns";
import {
  getChapter,
  listClosedChapterTexts,
  type Chapter,
} from "@/lib/db/chapters";
import { listMessagesInSeqRange } from "@/lib/db/messages";
import {
  chapterHasChunks,
  insertSceneChunks,
  listSceneChunksForChapters,
} from "@/lib/db/scene-chunks";
import { getDatabase } from "@/lib/db/core";
import { chunkScenes } from "@/lib/dm/scene-logic";
import {
  applyMmr,
  computeIdf,
  fuseRanked,
  fuseRRF,
  lexicalScore,
  rankByFusion,
} from "@/lib/dm/fusion-logic";
import {
  importanceRanking,
  scoreSceneImportance,
  type SceneSignals,
} from "@/lib/dm/importance-logic";
import { detectWitnesses } from "@/lib/dm/witness-logic";
import { listNpcs } from "@/lib/db/npcs";

// The memory index. Chapter close hands each sealed chapter here: its
// transcript is chunked into verbatim scenes and stored. Recall then runs
// two-phase: lexical scoring over chapter titles and summaries picks the
// likely chapters, lexical scoring over their scene rows returns the
// verbatim spans.

// Counts what the server recorded inside each scene's seq range, so
// importance is read off the record rather than inferred from the prose.
// Three range queries for the whole chapter, then bucketed by scene.
function gatherSceneSignals(
  campaignId: string,
  range: { seqStart: number; seqEnd: number },
  scenes: Array<{ seqStart: number; seqEnd: number }>,
): SceneSignals[] {
  const signals: SceneSignals[] = scenes.map(() => ({}));
  if (!scenes.length) {
    return signals;
  }
  // Scenes are contiguous and ordered, so a linear scan places each row.
  const bucketFor = (seq: number) =>
    scenes.findIndex((scene) => seq >= scene.seqStart && seq <= scene.seqEnd);
  const bump = (seq: number, key: keyof SceneSignals, amount = 1) => {
    const index = bucketFor(seq);
    if (index < 0) {
      return;
    }
    const bucket = signals[index] as Record<string, number>;
    bucket[key] = (bucket[key] ?? 0) + amount;
  };

  const db = getDatabase();
  try {
    const events = db
      .prepare(
        `SELECT seq, kind FROM character_events
         WHERE campaign_id = ? AND seq BETWEEN ? AND ?`,
      )
      .all(campaignId, range.seqStart, range.seqEnd) as Array<{ seq: number; kind: string }>;
    for (const event of events) {
      if (event.kind === "death") {
        bump(event.seq, "deaths");
      } else if (event.kind === "level_up") {
        bump(event.seq, "levelUps");
      } else if (event.kind === "story") {
        bump(event.seq, "storyEvents");
      } else if (event.kind === "relationship") {
        bump(event.seq, "relationshipShifts");
      } else {
        bump(event.seq, "otherEvents");
      }
    }

    const audits = db
      .prepare(
        `SELECT seq, kind FROM sheet_audit
         WHERE campaign_id = ? AND seq BETWEEN ? AND ?`,
      )
      .all(campaignId, range.seqStart, range.seqEnd) as Array<{ seq: number; kind: string }>;
    for (const audit of audits) {
      if (audit.kind === "stabilize") {
        bump(audit.seq, "deaths");
      } else if (audit.kind === "grant_item" || audit.kind === "modify_gold") {
        bump(audit.seq, "majorLoot");
      }
    }

    // rolls has no seq of its own; it hangs off the message it was attached to.
    const crits = db
      .prepare(
        `SELECT m.seq AS seq FROM rolls r
         JOIN campaign_messages m ON m.id = r.message_id
         WHERE r.campaign_id = ? AND m.seq BETWEEN ? AND ?
           AND (r.breakdown_json LIKE '%nat20%' OR r.breakdown_json LIKE '%nat1%')`,
      )
      .all(campaignId, range.seqStart, range.seqEnd) as Array<{ seq: number }>;
    for (const crit of crits) {
      bump(crit.seq, "crits");
    }
  } catch (error) {
    // Importance is an enhancement, never a reason to fail indexing: an
    // unscored chapter simply keeps the neutral default.
    console.error("[memory-index] importance signals failed", error);
  }

  // The chapter's closing beat lands in its last scene, which is where the
  // climax almost always sits.
  signals[signals.length - 1].beatCompleted = true;
  return signals;
}

// Indexes one closed chapter. Idempotent (skips chapters that already have
// chunks) and safe to fire-and-forget: any failure just leaves the chapter
// to keyword scoring over the raw transcript.
export async function indexChapter(campaignId: string, chapterId: string): Promise<void> {
  try {
    const chapter = getChapter(chapterId);
    if (!chapter || chapter.status !== "closed" || chapter.seqEnd === null) {
      return;
    }
    if (!chapterHasChunks(chapterId)) {
      const messages = listMessagesInSeqRange(campaignId, chapter.seqStart, chapter.seqEnd);
      const scenes = chunkScenes(messages);
      if (scenes.length) {
        const signals = gatherSceneSignals(
          campaignId,
          { seqStart: chapter.seqStart, seqEnd: chapter.seqEnd },
          scenes,
        );
        // Who was on screen for each span. Read off the prose because that
        // is where presence actually shows: the tools record that an NPC
        // exists, not that they were in the room for this exchange.
        const roster = listNpcs(campaignId).map((npc) => ({
          name: npc.name,
          aliases: npc.aliases,
        }));
        insertSceneChunks(
          scenes.map((scene, index) => ({
            campaignId,
            chapterId,
            seqStart: scene.seqStart,
            seqEnd: scene.seqEnd,
            text: scene.text,
            importance: scoreSceneImportance(signals[index]),
            witnesses: detectWitnesses(scene.text, roster),
          })),
        );
      }
    }
  } catch (error) {
    console.error("[memory-index] indexing failed", error);
  }
}

export type RecalledScene = {
  chapterIndex: number;
  seqStart: number;
  seqEnd: number;
  text: string;
  // Tracked NPCs on screen for this span; see src/lib/dm/witness-logic.ts.
  witnesses: string[];
};

const RECALL_SCENES = 3;
// Scene chunks are cut from a continuous transcript, so pull a wider set and
// let MMR thin it: without that, the three best matches for "the vault" are
// routinely three overlapping windows onto the same conversation.
const RECALL_CANDIDATES = 8;
const MMR_LAMBDA = 0.7;

// Recall over the memory index: every sealed scene is scored against the
// query with IDF-weighted lexical scoring (src/lib/dm/fusion-logic.ts), and
// the best are returned verbatim, diversified by MMR. Returns [] when the
// index is empty, and the caller falls back to keyword chapter scoring.
export async function searchScenes(
  campaignId: string,
  query: string,
): Promise<RecalledScene[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const chapters = listClosedChapterTexts(campaignId);
  if (!chapters.length) {
    return [];
  }
  const chapterIndexById = new Map(chapters.map((row) => [row.id, row.index]));

  const scenes = listSceneChunksForChapters(campaignId, chapters.map((row) => row.id));
  if (!scenes.length) {
    return [];
  }
  const language = campaignLanguage(campaignId);
  const sceneIdf = computeIdf(scenes.map((scene) => scene.text), language);
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const fusedSceneIds = fuseRanked(
    scenes.map((scene) => ({
      id: scene.id,
      lexical: lexicalScore(trimmed, scene.text, sceneIdf, language),
    })),
    { limit: RECALL_CANDIDATES },
  );

  const shortlist = fusedSceneIds
    .map((id) => sceneById.get(id))
    .filter((scene): scene is NonNullable<typeof scene> => scene !== undefined);

  // Importance enters as a third ranking rather than a score multiplier, so
  // it stays on the same scale-free footing as the other two. fusedSceneIds
  // is already relevance order, and importanceRanking keeps that order for
  // equal importance, so this breaks ties without overriding relevance: a
  // character's death wins over a shopping trip that matched just as well,
  // but never over one that matched better.
  const reranked = rankByFusion(
    fuseRRF([
      shortlist.map((scene) => scene.id),
      importanceRanking(
        shortlist.map((scene) => ({ id: scene.id, importance: scene.importance })),
      ),
    ]),
  );
  const candidates = reranked
    .map((id) => sceneById.get(id))
    .filter((scene): scene is NonNullable<typeof scene> => scene !== undefined)
    .map((scene) => ({ id: scene.id, text: scene.text, scene }));

  return applyMmr(candidates, RECALL_SCENES, language, MMR_LAMBDA).map(({ scene }) => ({
    chapterIndex: chapterIndexById.get(scene.chapterId) ?? 0,
    seqStart: scene.seqStart,
    seqEnd: scene.seqEnd,
    text: scene.text,
    witnesses: scene.witnesses,
  }));
}

// Convenience for the backfill script and chapter close.
export async function indexClosedChapters(campaignId: string, chapters: Chapter[]) {
  for (const chapter of chapters) {
    if (chapter.status === "closed") {
      await indexChapter(campaignId, chapter.id);
    }
  }
}

