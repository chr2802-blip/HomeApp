import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/lists/sync/route";
import { MAX_OPS, type OfflineOp } from "@/lib/offline-ops";
import { toggleListItem } from "@/app/actions/lists";
import {
  createHome,
  createHomeWithMembers,
  createList,
  createUser,
  formData,
  signIn,
  signOut,
} from "../helpers/factories";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let list: Awaited<ReturnType<typeof createList>>;

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
  list = await createList({ homeId: home.id, createdById: member.id });
});

function seedItem(overrides: { text?: string; done?: boolean; amount?: number } = {}) {
  return prisma.listItem.create({
    data: {
      listId: list.id,
      text: overrides.text ?? "Milk",
      done: overrides.done ?? false,
      amount: overrides.amount ?? 1,
      position: 1,
    },
  });
}

function send(ops: OfflineOp[]) {
  return POST(
    new Request("http://localhost/api/lists/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
    }),
  );
}

async function sent(ops: OfflineOp[]) {
  const response = await send(ops);
  expect(response.status).toBe(200);
  return (await response.json()) as { applied: string[]; rejected: { id: string }[] };
}

let opCounter = 0;
const opId = () => `op-${opCounter++}`;

const tickOp = (itemId: string, done: boolean): OfflineOp => ({
  id: opId(),
  kind: "tick",
  listId: list.id,
  itemId,
  done,
});

describe("who may send a queue", () => {
  it("refuses a request with no session", async () => {
    signOut();

    const response = await send([]);
    expect(response.status).toBe(401);
  });

  it("refuses a body that is not a batch of changes", async () => {
    const response = await POST(
      new Request("http://localhost/api/lists/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: [{ kind: "sudo" }] }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("refuses a body that is not JSON at all", async () => {
    const response = await POST(
      new Request("http://localhost/api/lists/sync", { method: "POST", body: "not json" }),
    );

    expect(response.status).toBe(400);
  });

  it("refuses more changes than one shop could hold", async () => {
    const item = await seedItem();
    const ops = Array.from({ length: MAX_OPS + 1 }, () => tickOp(item.id, true));

    expect((await send(ops)).status).toBe(400);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(false);
  });
});

describe("a queue of ticks", () => {
  it("ticks an item off and says who did it", async () => {
    const item = await seedItem();

    const result = await sent([tickOp(item.id, true)]);

    expect(result.rejected).toEqual([]);
    expect(result.applied).toHaveLength(1);
    expect(await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      done: true,
      completedById: member.id,
    });
  });

  it("lands on the same row when the same change arrives twice", async () => {
    // The whole reason an op carries the state to end in rather than "flip": a browser
    // that sent a queue and never heard back sends it again.
    const item = await seedItem();
    const op = tickOp(item.id, true);

    await sent([op]);
    await sent([op]);

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(true);
  });

  it("applies several ops about one row in the order they were made", async () => {
    const item = await seedItem();

    await sent([tickOp(item.id, true), tickOp(item.id, false), tickOp(item.id, true)]);

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(true);
  });

  it("drops the recipe note when the tick arrives, exactly as a press does", async () => {
    const item = await seedItem();
    const recipe = await prisma.recipe.create({
      data: {
        homeId: home.id,
        createdById: member.id,
        title: "Pancakes",
        ingredients: "Milk",
        instructions: "Mix.",
      },
    });
    await prisma.listItemSource.create({ data: { itemId: item.id, recipeId: recipe.id } });

    await sent([tickOp(item.id, true)]);

    expect(await prisma.listItemSource.count()).toBe(0);
  });

  it("puts an item back, with nobody's name on it", async () => {
    const item = await seedItem({ done: true });
    await prisma.listItem.update({
      where: { id: item.id },
      data: { completedById: member.id },
    });

    await sent([tickOp(item.id, false)]);

    expect(await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      done: false,
      completedById: null,
    });
  });

  it("counts the week when the tick that arrives is the one that empties the list", async () => {
    const item = await seedItem();

    await sent([tickOp(item.id, true)]);

    // The same record a press at the kitchen table writes: the household cleared a list,
    // whenever the phone happened to be able to say so.
    expect(await prisma.clearedWeek.count({ where: { homeId: home.id } })).toBe(1);
  });

  it("counts it once, however many times the queue is sent", async () => {
    const item = await seedItem();
    const op = tickOp(item.id, true);

    await sent([op]);
    await sent([op]);

    const week = await prisma.clearedWeek.findFirstOrThrow({ where: { homeId: home.id } });
    // A second arrival of the same tick did not clear the list a second time — it was
    // already clear. The count is the week's lists, not the week's requests.
    expect(week.count).toBe(1);
  });

  it("does not count a week when something is still open", async () => {
    const item = await seedItem();
    await seedItem({ text: "Bread" });

    await sent([tickOp(item.id, true)]);

    expect(await prisma.clearedWeek.count()).toBe(0);
  });
});

describe("a queue of additions", () => {
  const addOp = (text: string, itemId: string, amount = 1): OfflineOp => ({
    id: opId(),
    kind: "add",
    listId: list.id,
    itemId,
    text,
    amount,
  });

  it("creates the row under the id the phone chose", async () => {
    const result = await sent([addOp("Bin bags", "chosen-on-the-phone", 2)]);

    expect(result.rejected).toEqual([]);
    expect(
      await prisma.listItem.findUniqueOrThrow({ where: { id: "chosen-on-the-phone" } }),
    ).toMatchObject({ text: "Bin bags", amount: 2, done: false, listId: list.id });
  });

  it("adds one item when the same addition arrives twice", async () => {
    // Which is what the chosen id is for: the second arrival finds the row already there.
    const op = addOp("Bin bags", "chosen-on-the-phone");

    await sent([op]);
    await sent([op]);

    expect(await prisma.listItem.count({ where: { listId: list.id } })).toBe(1);
  });

  it("brings back a ticked row that already says it, rather than adding a second", async () => {
    await seedItem({ text: "Milk", done: true, amount: 1 });

    await sent([addOp("milk", "a-new-id", 3)]);

    const items = await prisma.listItem.findMany({ where: { listId: list.id } });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Milk", done: false, amount: 3 });
  });

  it("refuses one that is already on the list and not ticked off", async () => {
    await seedItem({ text: "Milk" });

    const result = await sent([addOp("Milk", "a-new-id")]);

    // Refused rather than kept: nothing about the list is going to change that later, so
    // the op is finished with and the browser may forget it.
    expect(result.applied).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.id).toBeTruthy();
    expect(await prisma.listItem.count({ where: { listId: list.id } })).toBe(1);
  });
});

describe("amounts", () => {
  it("sets the number the phone asked for", async () => {
    const item = await seedItem({ amount: 1 });

    await sent([{ id: opId(), kind: "amount", listId: list.id, itemId: item.id, amount: 6 }]);

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).amount).toBe(6);
  });
});

describe("what a queue may not reach", () => {
  it("refuses an item in another home, and changes nothing", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirList = await createList({ homeId: elsewhere.id, createdById: neighbour.id });
    const theirItem = await prisma.listItem.create({
      data: { listId: theirList.id, text: "Their milk", position: 1 },
    });

    const result = await sent([
      { id: opId(), kind: "tick", listId: theirList.id, itemId: theirItem.id, done: true },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: theirItem.id } })).done).toBe(
      false,
    );
  });

  it("refuses an addition to another home's list", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirList = await createList({ homeId: elsewhere.id, createdById: neighbour.id });

    const result = await sent([
      { id: opId(), kind: "add", listId: theirList.id, itemId: "mine", text: "Mine", amount: 1 },
    ]);

    expect(result.rejected).toHaveLength(1);
    expect(await prisma.listItem.count({ where: { listId: theirList.id } })).toBe(0);
  });

  it("refuses an op whose list and item do not belong together", async () => {
    const item = await seedItem();
    const other = await createList({ homeId: home.id, createdById: member.id });

    const result = await sent([
      { id: opId(), kind: "tick", listId: other.id, itemId: item.id, done: true },
    ]);

    expect(result.rejected).toHaveLength(1);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(false);
  });

  it("refuses an op about a row somebody has deleted, and applies the rest", async () => {
    const gone = await seedItem({ text: "Gone" });
    const here = await seedItem({ text: "Here" });
    await prisma.listItem.delete({ where: { id: gone.id } });

    const result = await sent([tickOp(gone.id, true), tickOp(here.id, true)]);

    // One bad op must not take the others down with it: the rest of the aisle still
    // counts.
    expect(result.rejected).toHaveLength(1);
    expect(result.applied).toHaveLength(1);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: here.id } })).done).toBe(true);
  });
});

describe("a queue beside the household's own presses", () => {
  it("agrees with a tick somebody else already made", async () => {
    const item = await seedItem();
    await prisma.listItem.create({ data: { listId: list.id, text: "Bread", position: 2 } });

    // Somebody at home ticks it off through the ordinary action while the phone is away.
    await toggleListItem(formData({ itemId: item.id }));

    // The phone arrives asking for the same thing, which is already true.
    const result = await sent([tickOp(item.id, true)]);

    expect(result.rejected).toEqual([]);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(true);
  });
});
