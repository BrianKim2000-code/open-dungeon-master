// Issue #31: chapters carry the act they belong to, and the story export
// groups them under act headings with the recap the table heard.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "node:module";
import { removeTempDir } from "./lib/remove-temp-dir.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "odm-chapter-acts-"));
process.env.SQLITE_DB_PATH = path.join(dir, "test.sqlite");

register("./lib/register-alias.mjs", import.meta.url);

const { createUser } = await import("../src/lib/db/users.ts");
const { createCampaign, setStoryArc, allocateSeq } = await import("../src/lib/db/campaigns.ts");
const { closeChapterRow, ensureOpenChapter, getChapter, listChapters, setChapterAct } = await import(
  "../src/lib/db/chapters.ts"
);
const { insertCampaignMessage } = await import("../src/lib/db/messages.ts");
const { normalizeStoryArc, recordActRecap } = await import("../src/lib/dm/arc-logic.ts");
const { homeGlanceFor } = await import("../src/lib/db/home-glance.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok: ${name}`);
}

const dm = createUser("dm", "x");
const campaign = createCampaign(dm.id, {
  title: "The Sunken Crown",
  description: "",
  theme: "",
  maxPlayers: 4,
  startingLevel: 1,
  difficulty: "normal",
});

function say(content) {
  const seq = allocateSeq(campaign.id);
  insertCampaignMessage({ campaignId: campaign.id, seq, authorType: "dm", content });
  return seq;
}

try {
  test("a chapter closes with the act it was in, and the next opens unstamped", () => {
    ensureOpenChapter(campaign.id);
    say("The marsh stretches before you.");
    const seqEnd = say("The ferryman waits.");
    const result = closeChapterRow(ensureOpenChapter(campaign.id).id, {
      title: "The Ferryman",
      summary: "You crossed the marsh.",
      highlights: ["You crossed the marsh."],
      seqEnd,
      act: 1,
      saga: 1,
    });
    assert.equal(result.closed.act, 1);
    assert.equal(result.closed.saga, 1);
    assert.equal(result.opened.act, null);
  });

  test("the open chapter is stamped once the arc says which act it starts", () => {
    const open = ensureOpenChapter(campaign.id);
    const stamped = setChapterAct(open.id, 2, 1);
    assert.equal(stamped.act, 2);
    assert.equal(getChapter(open.id).saga, 1);
  });

  test("chapters closed before acts were tracked read back as null", () => {
    say("A second chapter.");
    const seqEnd = say("It ends.");
    const result = closeChapterRow(ensureOpenChapter(campaign.id).id, {
      title: "Old Ways",
      summary: "",
      highlights: [],
      seqEnd,
    });
    assert.equal(result.closed.act, null);
    assert.equal(result.closed.saga, null);
  });

  test("two chapters in one act keep the same stamp, and the recap lands on the arc", () => {
    // A third chapter in act 2 and a fourth one after it, same act.
    say("Beneath the reliquary.");
    let seqEnd = say("The tomb opens.");
    closeChapterRow(ensureOpenChapter(campaign.id).id, {
      title: "The Tomb",
      summary: "You found the tomb.",
      highlights: [],
      seqEnd,
      act: 2,
      saga: 1,
    });
    say("Deeper still.");
    seqEnd = say("The heart beats.");
    closeChapterRow(ensureOpenChapter(campaign.id).id, {
      title: "The Heart",
      summary: "You heard it beat.",
      highlights: [],
      seqEnd,
      act: 2,
      saga: 1,
    });
    // Re-stamp the first chapter so the list has two acts to tell apart.
    const first = listChapters(campaign.id)[0];
    setChapterAct(first.id, 1, 1);
    const closed = listChapters(campaign.id);
    assert.deepEqual(
      closed.filter((chapter) => chapter.act === 2).length,
      2,
      "both act-2 chapters carry act 2",
    );
    assert.equal(getChapter(first.id).act, 1);
    const arc = recordActRecap(
      normalizeStoryArc({
        premise: "The heart wakes.",
        beats: [
          { text: "a", status: "done", act: 1 },
          { text: "b", status: "active", act: 2 },
        ],
        saga: {
          title: "The Sunken Crown",
          plannedActs: 2,
          sketches: [
            { act: 1, milestone: "Reach the drowned city.", status: "detailed", title: "The Drowned Road" },
            { act: 2, milestone: "Find the tomb.", status: "detailed", title: "Beneath the Reliquary" },
          ],
          finaleBoss: null,
          sagaIndex: 1,
          priorSagas: [],
        },
      }),
      { act: 1, sagaIndex: 1, title: "The Drowned Road", recap: "You crossed the marsh and paid the ferryman." },
    );
    setStoryArc(campaign.id, arc);
    // The recap lands on the arc's act list, keyed by act and saga, once.
    assert.deepEqual(
      arc.actRecaps.map((entry) => entry.act),
      [1],
    );
    assert.equal(arc.actRecaps[0].recap, "You crossed the marsh and paid the ferryman.");
    assert.equal(arc.actRecaps[0].title, "The Drowned Road");
    // A second recap for the same act replaces the first rather than stacking.
    const again = recordActRecap(arc, {
      act: 1,
      sagaIndex: 1,
      title: "The Drowned Road",
      recap: "You paid him twice.",
    });
    assert.equal(again.actRecaps.length, 1);
    assert.equal(again.actRecaps[0].recap, "You paid him twice.");
  });

  test("the title screen's glance names the act the open chapter is in", () => {
    // The open chapter is unstamped, so the act comes from the arc.
    const glance = homeGlanceFor(campaign.id, []);
    assert.equal(glance.chapter.act, 2);
    assert.equal(glance.chapter.actTitle, "Beneath the Reliquary");
    assert.ok(!JSON.stringify(glance).includes("Find the tomb"));
  });
} finally {
  removeTempDir(dir);
}

console.log(`test-chapter-acts: ${passed} tests passed`);
