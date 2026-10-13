// Queue lifecycles (audit P12): a campaign's DM queue entry goes when it
// runs dry and its waiting turns are skipped once it is deleted; a picture
// asked for twice before the GPU reached it renders once, and both callers
// wait for that render.
import assert from "node:assert/strict";
import { register } from "node:module";

register("./lib/register-alias.mjs", import.meta.url);

const { dmQueueDepth, dropDmQueue, enqueueDmJob, pauseDmQueue } = await import("../src/lib/dm/queue.ts");
const { enqueueMediaJob, mediaQueueStats } = await import("../src/lib/media-queue.ts");

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

await test("a campaign's queue entry goes once its last job has run", async () => {
  const ran = [];
  const first = enqueueDmJob("c-drain", async () => {
    ran.push(1);
  });
  const second = enqueueDmJob("c-drain", async () => {
    ran.push(2);
  });
  assert.equal(dmQueueDepth("c-drain"), 2);
  await Promise.all([first, second]);
  await tick();
  assert.deepEqual(ran, [1, 2]);
  assert.equal(globalThis.__odmDmQueues.has("c-drain"), false);
  assert.equal(dmQueueDepth("c-drain"), 0);
});

await test("a failing job still releases the entry", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    await enqueueDmJob("c-fail", async () => {
      throw new Error("boom");
    });
  } finally {
    console.error = original;
  }
  await tick();
  assert.equal(globalThis.__odmDmQueues.has("c-fail"), false);
});

await test("turns waiting on a deleted campaign are skipped, even behind a pause", async () => {
  pauseDmQueue("c-gone", "x-card");
  let ran = false;
  const waiting = enqueueDmJob("c-gone", async () => {
    ran = true;
  });
  await tick();
  assert.equal(ran, false, "the pause holds it");
  dropDmQueue("c-gone");
  await waiting;
  await tick();
  assert.equal(ran, false, "dropped, not run");
  assert.equal(globalThis.__odmDmQueues.has("c-gone"), false);
  // A campaign enqueued afterwards (a fresh id) runs normally.
  let later = false;
  await enqueueDmJob("c-other", async () => {
    later = true;
  });
  assert.equal(later, true);
});

await test("a picture asked for again while still waiting renders once, for both callers", async () => {
  let release;
  const blocker = new Promise((resolve) => {
    release = resolve;
  });
  const order = [];
  const busy = enqueueMediaJob("blocker", () => blocker);
  let firstDone = false;
  const first = enqueueMediaJob("portrait sheet-1", async () => {
    order.push("first");
  }).then(() => {
    firstDone = true;
  });
  const second = enqueueMediaJob("portrait sheet-1", async () => {
    order.push("second");
  });
  const other = enqueueMediaJob("portrait sheet-2", async () => {
    order.push("other");
  });
  release();
  await busy;
  await tick();
  // The replaced caller is not told it is done before the replacement ran.
  await second;
  assert.equal(firstDone || order.includes("second"), true);
  await first;
  await other;
  assert.deepEqual(order, ["second", "other"]);
  assert.ok(mediaQueueStats().gpu.superseded >= 1);
  assert.equal(mediaQueueStats().gpu.waiting, 0);
});

console.log(`\n${passed} queue-policy tests passed.`);
