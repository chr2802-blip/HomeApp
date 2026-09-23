import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addListItem,
  createList,
  deleteList,
  deleteListItem,
  renameListItem,
  reorderListItems,
  restoreListItem,
  setListItemAmount,
  toggleListFavorite,
  toggleListItem,
  updateList,
} from "@/app/actions/lists";
import {
  createHomeWithMembers,
  createList as seedList,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";
import { homeStreak } from "@/lib/streak";
import { previousWeekStart, weekStartInZone } from "@/lib/time";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];

beforeEach(async () => {
  ({ home, member, admin } = await createHomeWithMembers());
  await signIn(member);
});

describe("createList", () => {
  it("creates a list in the caller's home and opens it", async () => {
    const destination = await captureRedirect(() => createList(undefined, formData({ title: "Groceries" })));

    const list = await prisma.list.findFirstOrThrow();
    expect(list).toMatchObject({ title: "Groceries", homeId: home.id, createdById: member.id });
    expect(destination).toBe(`/lists/${list.id}`);
  });

  it("trims the title", async () => {
    await captureRedirect(() => createList(undefined, formData({ title: "  Hardware store  " })));

    expect((await prisma.list.findFirstOrThrow()).title).toBe("Hardware store");
  });

  it("ignores an empty title", async () => {
    await createList(undefined, formData({ title: "   " }));

    expect(await prisma.list.count()).toBe(0);
  });

  it("leaves amounts off unless the box is ticked", async () => {
    await captureRedirect(() => createList(undefined, formData({ title: "Jobs" })));

    expect((await prisma.list.findFirstOrThrow()).trackAmounts).toBe(false);
  });

  it("turns amounts on when the box is ticked", async () => {
    await captureRedirect(() =>
      createList(undefined, formData({ title: "Groceries", trackAmounts: "on" })),
    );

    expect((await prisma.list.findFirstOrThrow()).trackAmounts).toBe(true);
  });

  it("allows two lists with the same name", async () => {
    await captureRedirect(() => createList(undefined, formData({ title: "Shopping" })));
    await captureRedirect(() => createList(undefined, formData({ title: "Shopping" })));

    expect(await prisma.list.count()).toBe(2);
  });
});

describe("updateList", () => {
  it("renames the list", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await updateList(undefined, formData({ listId: list.id, title: "Weekly shop" }));

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).title).toBe(
      "Weekly shop",
    );
  });

  it("ignores a blank new title", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await updateList(undefined, formData({ listId: list.id, title: "  " }));

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).title).toBe("Shopping");
  });

  it("turns amounts on and off again", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await updateList(undefined, formData({ listId: list.id, title: "Shopping", trackAmounts: "on" }));
    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).trackAmounts).toBe(true);

    await updateList(undefined, formData({ listId: list.id, title: "Shopping" }));
    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).trackAmounts).toBe(
      false,
    );
  });

  it("keeps the amounts already on the items when the setting is turned off", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await prisma.listItem.create({ data: { listId: list.id, text: "Milk", amount: 3, position: 1 } });

    await updateList(undefined, formData({ listId: list.id, title: "Shopping" }));

    expect((await prisma.listItem.findFirstOrThrow()).amount).toBe(3);
  });
});

describe("deleteList", () => {
  it("deletes the list and its items, then returns to the index", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await prisma.listItem.create({ data: { listId: list.id, text: "Milk", position: 1 } });

    await expectRedirect(() => deleteList(formData({ listId: list.id })), "/lists");

    expect(await prisma.list.count()).toBe(0);
    expect(await prisma.listItem.count()).toBe(0);
  });

  it("fails loudly for a list that does not exist", async () => {
    await expect(deleteList(formData({ listId: "missing" }))).rejects.toThrow("List not found");
  });
});

describe("list items", () => {
  it("adds items in order, each at the end", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    await addListItem(undefined, formData({ listId: list.id, text: "Bread" }));
    await addListItem(undefined, formData({ listId: list.id, text: "Eggs" }));

    const items = await prisma.listItem.findMany({ orderBy: { position: "asc" } });
    expect(items.map((item) => item.text)).toEqual(["Milk", "Bread", "Eggs"]);
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("keeps adding to the end after an earlier item is removed", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    await addListItem(undefined, formData({ listId: list.id, text: "Bread" }));

    const milk = await prisma.listItem.findFirstOrThrow({ where: { text: "Milk" } });
    await deleteListItem(formData({ itemId: milk.id }));
    await addListItem(undefined, formData({ listId: list.id, text: "Eggs" }));

    const items = await prisma.listItem.findMany({ orderBy: { position: "asc" } });
    expect(items.map((item) => item.text)).toEqual(["Bread", "Eggs"]);
  });

  it("trims item text and ignores empty items", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await addListItem(undefined, formData({ listId: list.id, text: "  Butter  " }));
    await addListItem(undefined, formData({ listId: list.id, text: "   " }));

    const items = await prisma.listItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe("Butter");
  });

  it("toggles an item done and back again", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    const item = await prisma.listItem.findFirstOrThrow();

    await toggleListItem(formData({ itemId: item.id }));
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(true);

    await toggleListItem(formData({ itemId: item.id }));
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(false);
  });

  it("deletes a single item", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    const item = await prisma.listItem.findFirstOrThrow();

    await deleteListItem(formData({ itemId: item.id }));

    expect(await prisma.listItem.count()).toBe(0);
  });

  it("quietly ignores an item that no longer exists", async () => {
    await expect(toggleListItem(formData({ itemId: "missing" }))).resolves.toBeUndefined();
    await expect(deleteListItem(formData({ itemId: "missing" }))).resolves.toBeUndefined();
  });

  it("records who ticked it off, and nobody once it is back on the list", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    const item = await prisma.listItem.findFirstOrThrow();

    await toggleListItem(formData({ itemId: item.id }));
    expect(
      (await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } }))
        .completedById,
    ).toBe(member.id);

    // The name answers "who is getting this", which is a question about the shop still
    // to do — putting the item back leaves nothing for it to answer.
    await toggleListItem(formData({ itemId: item.id }));
    expect(
      (await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } }))
        .completedById,
    ).toBeNull();
  });

  it("resets the amount to one when the item is ticked off, and leaves it there when it comes back", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk", amount: "3" }));
    const item = await prisma.listItem.findFirstOrThrow();

    await toggleListItem(formData({ itemId: item.id }));
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).amount).toBe(1);

    // Putting it back is not a second opinion about how many are wanted this time.
    await toggleListItem(formData({ itemId: item.id }));
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).amount).toBe(1);
  });

  it("names whoever actually pressed it, not the person who wrote the list", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    const item = await prisma.listItem.findFirstOrThrow();

    await signIn(admin);
    await toggleListItem(formData({ itemId: item.id }));

    expect(
      (await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } }))
        .completedById,
    ).toBe(admin.id);
  });
});

/**
 * The household's streak, which is written by the tick that empties a list.
 *
 * Every one of these is about *which* press counts. The row is the whole record — there
 * is nowhere else to read a clearing from afterwards — so a press that writes one when
 * it should not is a streak nobody earned, and one that forgets is a streak broken by
 * the app rather than by the household.
 */
describe("clearing a list", () => {
  async function listWithItems(texts: string[]) {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    for (const text of texts) {
      await addListItem(undefined, formData({ listId: list.id, text }));
    }
    return {
      list,
      items: await prisma.listItem.findMany({ orderBy: { position: "asc" } }),
    };
  }

  const weeks = () => prisma.clearedWeek.findMany();

  it("counts the week when the last open item is ticked off, and not before", async () => {
    const { items } = await listWithItems(["Milk", "Bread"]);

    await toggleListItem(formData({ itemId: items[0]!.id }));
    expect(await weeks()).toHaveLength(0);

    await toggleListItem(formData({ itemId: items[1]!.id }));
    expect(await weeks()).toMatchObject([
      { homeId: home.id, week: weekStartInZone(), count: 1 },
    ]);
  });

  it("raises the count rather than adding a row for a second list in the same week", async () => {
    const first = await listWithItems(["Milk"]);
    const second = await listWithItems(["Nails"]);

    await toggleListItem(formData({ itemId: first.items[0]!.id }));
    await toggleListItem(formData({ itemId: second.items.at(-1)!.id }));

    // One row per home per week is the shape the table can take at all, so this is as
    // much about the key as about the count.
    expect(await weeks()).toMatchObject([
      { week: weekStartInZone(), count: 2 },
    ]);
  });

  it("counts nothing when a list is emptied by deleting its rows", async () => {
    const { items } = await listWithItems(["Milk", "Bread"]);

    await deleteListItem(formData({ itemId: items[0]!.id }));
    await deleteListItem(formData({ itemId: items[1]!.id }));

    // The list has nothing open on it and nothing was finished. A household that gives
    // up on the shopping has not cleared a list.
    expect(await weeks()).toHaveLength(0);
  });

  it("counts nothing for a tick that puts an item back", async () => {
    const { items } = await listWithItems(["Milk"]);

    await toggleListItem(formData({ itemId: items[0]!.id }));
    await toggleListItem(formData({ itemId: items[0]!.id }));

    expect(await weeks()).toMatchObject([{ count: 1 }]);
  });

  it("keeps each household's weeks to itself", async () => {
    const neighbour = await createHomeWithMembers();
    const { items } = await listWithItems(["Milk"]);
    await toggleListItem(formData({ itemId: items[0]!.id }));

    expect(await homeStreak(home.id)).toMatchObject({ weeks: 1, thisWeek: 1 });
    expect(await homeStreak(neighbour.home.id)).toMatchObject({
      weeks: 0,
      thisWeek: 0,
    });
  });
});

describe("homeStreak", () => {
  /** Weeks the household cleared something in, counted back from the live one. */
  async function clearedWeeksAgo(...agos: number[]) {
    for (const ago of agos) {
      let week = weekStartInZone();
      for (let step = 0; step < ago; step += 1) week = previousWeekStart(week);
      await prisma.clearedWeek.create({ data: { homeId: home.id, week } });
    }
  }

  it("is nothing at all for a household that has never cleared one", async () => {
    expect(await homeStreak(home.id)).toEqual({ weeks: 0, thisWeek: 0 });
  });

  it("counts back while the weeks are unbroken", async () => {
    await clearedWeeksAgo(0, 1, 2);
    expect(await homeStreak(home.id)).toMatchObject({ weeks: 3, thisWeek: 1 });
  });

  it("stops at the first week nothing was cleared in", async () => {
    await clearedWeeksAgo(0, 1, 3, 4);
    expect(await homeStreak(home.id)).toMatchObject({ weeks: 2 });
  });

  it("lives on through a week that has only just begun", async () => {
    // Cleared last week and nothing yet this one. The week is not over, so nothing has
    // been broken — expiring it at midnight on Sunday would punish the calendar.
    await clearedWeeksAgo(1, 2);
    expect(await homeStreak(home.id)).toMatchObject({ weeks: 2, thisWeek: 0 });
  });

  it("is over once a whole week has passed with nothing in it", async () => {
    await clearedWeeksAgo(2, 3, 4);
    expect(await homeStreak(home.id)).toMatchObject({ weeks: 0, thisWeek: 0 });
  });
});

describe("adding something already on the list", () => {
  async function listWith(entries: { text: string; done: boolean }[]) {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await prisma.listItem.createMany({
      data: entries.map((entry, index) => ({
        listId: list.id,
        text: entry.text,
        done: entry.done,
        position: index + 1,
      })),
    });
    return list;
  }

  it("puts a ticked item back instead of making a second one", async () => {
    const list = await listWith([{ text: "Milk", done: true }]);

    const result = await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));

    expect(result).toEqual({ ok: true });
    const items = await prisma.listItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Milk", done: false });
  });

  it("matches however it was capitalised or spaced", async () => {
    const list = await listWith([{ text: "Milk", done: true }]);

    await addListItem(undefined, formData({ listId: list.id, text: "  mILk  " }));

    const items = await prisma.listItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Milk", done: false });
  });

  it("moves the restored item to the end of what is still outstanding", async () => {
    const list = await listWith([
      { text: "Milk", done: true },
      { text: "Bread", done: false },
      { text: "Eggs", done: false },
    ]);

    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));

    const open = await prisma.listItem.findMany({
      where: { done: false },
      orderBy: { position: "asc" },
    });
    expect(open.map((item) => item.text)).toEqual(["Bread", "Eggs", "Milk"]);
  });

  it("says so when the item is already outstanding", async () => {
    const list = await listWith([{ text: "Milk", done: false }]);

    const result = await addListItem(undefined, formData({ listId: list.id, text: "milk" }));

    expect(result).toEqual({ ok: false, error: "“Milk” is already on the list." });
    expect(await prisma.listItem.count()).toBe(1);
  });

  it("still adds something genuinely new", async () => {
    const list = await listWith([{ text: "Milk", done: true }]);

    await addListItem(undefined, formData({ listId: list.id, text: "Bread" }));

    expect(await prisma.listItem.count()).toBe(2);
  });

  it("does not match an item on a different list", async () => {
    const other = await seedList({ homeId: home.id, createdById: member.id, title: "Other" });
    await prisma.listItem.create({
      data: { listId: other.id, text: "Milk", done: true, position: 1 },
    });
    const list = await listWith([]);

    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));

    expect(await prisma.listItem.count({ where: { listId: list.id } })).toBe(1);
    expect(await prisma.listItem.count({ where: { listId: other.id, done: true } })).toBe(1);
  });
});

describe("amounts", () => {
  async function listWithItem(text = "Milk", fields: Record<string, string> = {}) {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text, ...fields }));
    return { list, item: await prisma.listItem.findFirstOrThrow() };
  }

  it("defaults to one when the form does not send an amount", async () => {
    const { item } = await listWithItem();

    expect(item.amount).toBe(1);
  });

  it("stores the amount the add box was showing", async () => {
    const { item } = await listWithItem("Milk", { amount: "3" });

    expect(item.amount).toBe(3);
  });

  it("sets a new amount on an item", async () => {
    const { item } = await listWithItem();

    await setListItemAmount(formData({ itemId: item.id, amount: "4" }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).amount).toBe(4);
  });

  // The picker cannot offer these; a request carrying one was written by hand.
  it.each([
    ["0", 1],
    ["-5", 1],
    ["", 1],
    ["nonsense", 1],
    ["7.6", 8],
    ["1000", 99],
  ])("clamps %s to %i", async (sent, stored) => {
    const { item } = await listWithItem();

    await setListItemAmount(formData({ itemId: item.id, amount: sent }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).amount).toBe(
      stored,
    );
  });

  it("quietly ignores an item that no longer exists", async () => {
    await expect(
      setListItemAmount(formData({ itemId: "missing", amount: "2" })),
    ).resolves.toBeUndefined();
  });

  it("takes the new amount when a ticked item is added again", async () => {
    const { list, item } = await listWithItem("Milk", { amount: "2" });
    await toggleListItem(formData({ itemId: item.id }));

    await addListItem(undefined, formData({ listId: list.id, text: "Milk", amount: "5" }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } }))).toMatchObject({
      amount: 5,
      done: false,
    });
  });
});

describe("renaming an item", () => {
  async function listWithItem(text = "Milk") {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text }));
    return { list, item: await prisma.listItem.findFirstOrThrow() };
  }

  it("changes what the item says", async () => {
    const { item } = await listWithItem();

    await renameListItem(formData({ itemId: item.id, text: "Oat milk" }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).text).toBe(
      "Oat milk",
    );
  });

  it("trims what was typed", async () => {
    const { item } = await listWithItem();

    await renameListItem(formData({ itemId: item.id, text: "  Oat milk  " }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).text).toBe(
      "Oat milk",
    );
  });

  // The editor falls back to the row's own wording rather than sending nothing here to
  // be rejected, so blank arriving at all means a request written by hand.
  it("ignores blank text and leaves the item as it was", async () => {
    const { item } = await listWithItem();

    await renameListItem(formData({ itemId: item.id, text: "   " }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).text).toBe(
      "Milk",
    );
  });

  it("quietly ignores an item that no longer exists", async () => {
    await expect(
      renameListItem(formData({ itemId: "missing", text: "Oat milk" })),
    ).resolves.toBeUndefined();
  });

  it("refuses another home's item", async () => {
    const neighbour = await createHomeWithMembers();
    const otherList = await seedList({ homeId: neighbour.home.id, createdById: neighbour.member.id });
    const item = await prisma.listItem.create({
      data: { listId: otherList.id, text: "Milk", position: 1 },
    });

    // `member` is signed in and belongs to `home`, not `neighbour.home`.
    await expect(
      renameListItem(formData({ itemId: item.id, text: "Oat milk" })),
    ).rejects.toThrow();

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).text).toBe(
      "Milk",
    );
  });
});

describe("restoreListItem", () => {
  it("unticks the item and sends it to the end", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await prisma.listItem.createMany({
      data: [
        { listId: list.id, text: "Milk", done: true, position: 1 },
        { listId: list.id, text: "Bread", done: false, position: 2 },
      ],
    });
    const milk = await prisma.listItem.findFirstOrThrow({ where: { text: "Milk" } });

    await restoreListItem(formData({ itemId: milk.id }));

    const open = await prisma.listItem.findMany({ where: { done: false }, orderBy: { position: "asc" } });
    expect(open.map((item) => item.text)).toEqual(["Bread", "Milk"]);
  });

  it("brings the amount standing in the add box with it", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    const milk = await prisma.listItem.create({
      data: { listId: list.id, text: "Milk", amount: 2, done: true, position: 1 },
    });

    await restoreListItem(formData({ itemId: milk.id, amount: "4" }));

    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: milk.id } })).amount).toBe(4);
  });

  it("ignores an item that no longer exists", async () => {
    await expect(restoreListItem(formData({ itemId: "missing" }))).resolves.toBeUndefined();
  });
});

describe("favourites", () => {
  const starsOf = (userId: string) =>
    prisma.listFavorite
      .findMany({ where: { userId }, include: { list: true } })
      .then((rows) => rows.map((row) => row.list.title));

  it("stars a list for the person who asked", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await toggleListFavorite(formData({ listId: list.id }));

    expect(await starsOf(member.id)).toEqual(["Shopping"]);
  });

  it("unstars it when asked again", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await toggleListFavorite(formData({ listId: list.id }));
    await toggleListFavorite(formData({ listId: list.id }));

    expect(await prisma.listFavorite.count()).toBe(0);
  });

  it("keeps one person's favourites out of another's, in the same home", async () => {
    const housemate = await createUser({ homeId: home.id });
    const shopping = await seedList({ homeId: home.id, createdById: member.id });
    const jobs = await seedList({ homeId: home.id, createdById: member.id, title: "Jobs" });

    await toggleListFavorite(formData({ listId: shopping.id }));

    await signIn(housemate);
    await toggleListFavorite(formData({ listId: jobs.id }));

    expect(await starsOf(member.id)).toEqual(["Shopping"]);
    expect(await starsOf(housemate.id)).toEqual(["Jobs"]);
  });

  it("stars for the caller, whatever the form says", async () => {
    const housemate = await createUser({ homeId: home.id });
    const list = await seedList({ homeId: home.id, createdById: member.id });

    // A hand-written request naming somebody else only ever stars the sender's own.
    await toggleListFavorite(formData({ listId: list.id, userId: housemate.id }));

    expect(await starsOf(member.id)).toEqual(["Shopping"]);
    expect(await starsOf(housemate.id)).toEqual([]);
  });

  it("goes away with the list", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await toggleListFavorite(formData({ listId: list.id }));

    await expectRedirect(() => deleteList(formData({ listId: list.id })), "/lists");

    expect(await prisma.listFavorite.count()).toBe(0);
  });

  it("goes away with the person", async () => {
    const housemate = await createUser({ homeId: home.id });
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await signIn(housemate);
    await toggleListFavorite(formData({ listId: list.id }));

    await prisma.user.delete({ where: { id: housemate.id } });

    expect(await prisma.listFavorite.count()).toBe(0);
  });

  it("fails loudly for a list that does not exist", async () => {
    await expect(toggleListFavorite(formData({ listId: "missing" }))).rejects.toThrow(
      "List not found",
    );
  });
});

describe("reorderListItems", () => {
  async function threeItems() {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await prisma.listItem.createMany({
      data: [
        { listId: list.id, text: "One", position: 1 },
        { listId: list.id, text: "Two", position: 2 },
        { listId: list.id, text: "Three", position: 3 },
      ],
    });
    const items = await prisma.listItem.findMany({ orderBy: { position: "asc" } });
    return { list, items };
  }

  const order = () =>
    prisma.listItem
      .findMany({ orderBy: { position: "asc" } })
      .then((items) => items.map((item) => item.text));

  it("writes the order it is given", async () => {
    const { list, items } = await threeItems();
    const [one, two, three] = items;

    await reorderListItems(
      formData({ listId: list.id, itemIds: [three!.id, one!.id, two!.id].join(",") }),
    );

    expect(await order()).toEqual(["Three", "One", "Two"]);
  });

  it("leaves positions consecutive, so the next added item still lands last", async () => {
    const { list, items } = await threeItems();
    await reorderListItems(
      formData({ listId: list.id, itemIds: items.map((item) => item.id).reverse().join(",") }),
    );

    await addListItem(undefined, formData({ listId: list.id, text: "Four" }));

    expect(await order()).toEqual(["Three", "Two", "One", "Four"]);
  });

  it("ignores ids that belong to another list", async () => {
    const { list, items } = await threeItems();
    const other = await seedList({ homeId: home.id, createdById: member.id, title: "Other" });
    const foreign = await prisma.listItem.create({
      data: { listId: other.id, text: "Foreign", position: 1 },
    });

    await reorderListItems(
      formData({ listId: list.id, itemIds: [foreign.id, items[2]!.id, items[0]!.id].join(",") }),
    );

    // The foreign id is dropped; the rest are renumbered in the order given.
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: foreign.id } })).position).toBe(1);

    /*
     * Read as positions rather than as an order, because a request naming only some of
     * a list's items leaves the rest where they were: "Two" is still at 2 and "One" has
     * just been moved to 2 as well, and two rows sharing a position come back from
     * `orderBy: { position: "asc" }` in whichever order Postgres feels like. Asserting
     * the order made this test a coin flip that landed the right way up for months.
     *
     * The tie is the test's own doing and not the app's: the page sends every open item
     * it is showing, so a real drag renumbers all of them.
     */
    const positions = Object.fromEntries(
      (await prisma.listItem.findMany({ where: { listId: list.id } })).map((item) => [
        item.text,
        item.position,
      ]),
    );
    expect(positions).toEqual({ Three: 1, One: 2, Two: 2 });
  });

  it("does nothing when given no ids", async () => {
    const { list } = await threeItems();

    await reorderListItems(formData({ listId: list.id, itemIds: "" }));

    expect(await order()).toEqual(["One", "Two", "Three"]);
  });
});
