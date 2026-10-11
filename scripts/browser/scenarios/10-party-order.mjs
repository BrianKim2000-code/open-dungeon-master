// Issue 240: each viewer puts the Party panel's cards in their own order.
// Arrange, move a card with the arrows and by dragging its handle, see the
// order kept across a reload (it is saved on the membership), and reset it.
// Nothing here opens a sheet or changes the table for anyone else.
import { check, eventually, sleep } from "../lib.mjs";

export default {
  name: "party-order",
  viewports: ["desktop", "phone"],
  async run(t) {
    const { page, root, ids, api, base } = t;
    await t.open(`/campaigns/${ids.campaignId}`);
    const cards = () => page.locator(`${root}[data-party-card]`).locator("visible=true");
    const shown = async () => {
      const list = await cards().evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-party-card")));
      return list;
    };
    await eventually(async () => (await cards().count()) >= 2, { timeoutMs: 30_000, label: "two party cards" });
    const start = await shown();
    check(start[0] === ids.tavi && start[1] === ids.brann, `the table's own order first: Tavi then Brann (${start.join(", ")})`);

    const arrange = page.getByRole("button", { name: /^arrange$/i }).locator("visible=true").first();
    await eventually(() => arrange.count(), { label: "the Arrange button" });
    await t.tap(arrange);
    const handles = page.locator(`${root}.party-grip`).locator("visible=true");
    await eventually(async () => (await handles.count()) >= 2, { label: "a handle on every card" });
    await t.shot("arranging");

    // The arrow: Tavi goes down, Brann is first.
    await t.tap(page.getByRole("button", { name: /^move tavi lockwhisper down$/i }).locator("visible=true").first());
    await eventually(async () => (await shown())[0] === ids.brann, { label: "Brann first after the arrow" });
    check((await shown())[1] === ids.tavi, "Tavi second after the arrow");
    const settled = page.locator(`${root}[data-party-card][data-moved]`);
    await eventually(() => settled.count(), { timeoutMs: 2_000, label: "the moved card settling with motion" });

    // Saved on the membership, as the lead's own.
    await eventually(async () => {
      const response = await api.get(`${base}/api/campaigns/${ids.campaignId}`);
      const data = await response.json();
      const mine = (data.members ?? []).find((member) => member.username === ids.lead);
      return mine && mine.partyOrder?.[0] === ids.brann && mine.partyOrder?.[1] === ids.tavi;
    }, { label: "the order saved on the lead's membership" });

    // Dragging the handle: Tavi's grip up over Brann's card, let go above its
    // middle: Tavi is first again.
    const taviGrip = page.locator(`${root}[data-party-card="${ids.tavi}"] .party-grip`).locator("visible=true").first();
    const brannCard = page.locator(`${root}[data-party-card="${ids.brann}"]`).locator("visible=true").first();
    const grip = await taviGrip.boundingBox();
    const target = await brannCard.boundingBox();
    check(Boolean(grip && target), "the grip and the other card are on screen");
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, target.y + 8, { steps: 6 });
    await sleep(120);
    const drop = await page.locator(`${root}[data-party-card="${ids.brann}"][data-drop="before"]`).count();
    check(drop === 1, "the drop line shows above Brann while dragging");
    await page.mouse.move(grip.x + grip.width / 2, target.y + 6, { steps: 2 });
    await page.mouse.up();
    await eventually(async () => (await shown())[0] === ids.tavi, { label: "Tavi first after the drag" });
    check((await page.locator(`${root}[data-party-card][data-drop]`).count()) === 0, "no drop line once let go");

    // The order survives a reload: it came from the membership, not the tab.
    await t.tap(page.getByRole("button", { name: /^move tavi lockwhisper down$/i }).locator("visible=true").first());
    await eventually(async () => (await shown())[0] === ids.brann, { label: "Brann first before the reload" });
    await t.open(`/campaigns/${ids.campaignId}`);
    await eventually(async () => (await cards().count()) >= 2, { timeoutMs: 30_000, label: "the cards after the reload" });
    const kept = await shown();
    check(kept[0] === ids.brann && kept[1] === ids.tavi, `the order kept across a reload (${kept.join(", ")})`);
    check((await page.locator(`${root}.party-grip`).count()) === 0, "arranging is off again after a reload; the cards are plain");

    // Reset: back to the table's own order, for every run after this one.
    await t.tap(page.getByRole("button", { name: /^arrange$/i }).locator("visible=true").first());
    const reset = page.getByRole("button", { name: /^reset order$/i }).locator("visible=true").first();
    await eventually(() => reset.count(), { label: "the Reset order button once an order is the viewer's own" });
    await t.tap(reset);
    await eventually(async () => (await shown())[0] === ids.tavi, { label: "the table's order back after the reset" });
    await eventually(() => reset.count().then((count) => count === 0), { label: "nothing left to reset" });
    await t.tap(page.getByRole("button", { name: /^done$/i }).locator("visible=true").first());
    await eventually(() => page.locator(`${root}.party-grip`).count().then((count) => count === 0), { label: "the handles gone on Done" });
    await t.shot("reset");
  },
};
