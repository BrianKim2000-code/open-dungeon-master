// The table snapshot no longer grows with a campaign's whole history (audit
// P9): older closed chapters ride without their summary and highlights (the
// story panel reads them from /chapters).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "node:module";
import { removeTempDir } from "./lib/remove-temp-dir.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "odm-snapshot-slim-"));
process.env.SQLITE_DB_PATH = path.join(dir, "test.sqlite");
process.env.DB_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.chdir(dir);
register("./lib/register-routes.mjs", import.meta.url);

const { createUser } = await import("../src/lib/db/users.ts");
const { createCampaign, allocateSeq } = await import("../src/lib/db/campaigns.ts");
const { mintSession } = await import("../src/lib/auth.ts");
const { closeChapterRow, ensureOpenChapter, listChapters, SNAPSHOT_FULL_CHAPTERS } = await import("../src/lib/db/chapters.ts");
const { insertCampaignMessage } = await import("../src/lib/db/messages.ts");
const snapshotRoute = await import("../src/app/api/campaigns/[campaignId]/route.ts");
const chaptersRoute = await import("../src/app/api/campaigns/[campaignId]/chapters/route.ts");

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const dm = createUser("dm", "x");
const campaign = createCampaign(dm.id, { title: "Long road", description: "", theme: "", maxPlayers: 4, startingLevel: 1, difficulty: "normal" });
globalThis.__odmTestToken = mintSession(dm.id).token;

const CLOSED = SNAPSHOT_FULL_CHAPTERS + 8;
for (let index = 0; index < CLOSED; index += 1) {
  const open = ensureOpenChapter(campaign.id);
  closeChapterRow(open.id, {
    title: `Chapter ${open.index}`,
    summary: `What happened in chapter ${open.index}. `.repeat(40),
    highlights: [`A moment of chapter ${open.index}`],
    seqEnd: allocateSeq(campaign.id),
  });
}
const params = { params: Promise.resolve({ campaignId: campaign.id }) };
const snapshot = async () => (await snapshotRoute.GET(new Request("http://x/"), params)).json();

await test("older closed chapters ride without their text; the newest and the open one whole", async () => {
  const { chapters } = await snapshot();
  assert.equal(chapters.length, CLOSED + 1);
  const closed = chapters.filter((chapter) => chapter.status === "closed");
  const abridged = closed.filter((chapter) => chapter.abridged);
  assert.equal(abridged.length, CLOSED - SNAPSHOT_FULL_CHAPTERS);
  for (const chapter of abridged) {
    assert.equal(chapter.summary, "");
    assert.deepEqual(chapter.highlights, []);
    assert.match(chapter.title, /Chapter \d+/, "the title stays for the list");
  }
  for (const chapter of closed.slice(-SNAPSHOT_FULL_CHAPTERS)) {
    assert.ok(!chapter.abridged && chapter.summary.length > 100, chapter.title);
  }
  assert.ok(chapters.some((chapter) => chapter.status === "open"));
});

await test("the story panel's own read still has every summary", async () => {
  const { chapters } = await (await chaptersRoute.GET(new Request("http://x/"), params)).json();
  assert.equal(chapters.filter((chapter) => chapter.status === "closed" && chapter.summary.length > 100).length, CLOSED);
  assert.ok(chapters.every((chapter) => !chapter.abridged));
  assert.equal(listChapters(campaign.id).length, CLOSED + 1);
});

removeTempDir(dir);
console.log(`\n${passed} snapshot-slim tests passed.`);
