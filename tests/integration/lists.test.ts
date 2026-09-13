import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addListItem,
  clearCompletedItems,
  createList,
  deleteList,
  deleteListItem,
  renameList,
  reorderListItems,
  restoreListItem,
  toggleListItem,
} from "@/app/actions/lists";
import {
  createHomeWithMembers,
  createList as seedList,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
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

  it("allows two lists with the same name", async () => {
    await captureRedirect(() => createList(undefined, formData({ title: "Shopping" })));
    await captureRedirect(() => createList(undefined, formData({ title: "Shopping" })));

    expect(await prisma.list.count()).toBe(2);
  });
});

describe("renameList", () => {
  it("renames the list", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await renameList(undefined, formData({ listId: list.id, title: "Weekly shop" }));

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).title).toBe(
      "Weekly shop",
    );
  });

  it("ignores a blank new title", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });

    await renameList(undefined, formData({ listId: list.id, title: "  " }));

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).title).toBe("Shopping");
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

  it("clears only the completed items", async () => {
    const list = await seedList({ homeId: home.id, createdById: member.id });
    await addListItem(undefined, formData({ listId: list.id, text: "Milk" }));
    await addListItem(undefined, formData({ listId: list.id, text: "Bread" }));
    const milk = await prisma.listItem.findFirstOrThrow({ where: { text: "Milk" } });
    await toggleListItem(formData({ itemId: milk.id }));

    await clearCompletedItems(formData({ listId: list.id }));

    const remaining = await prisma.listItem.findMany();
    expect(remaining.map((item) => item.text)).toEqual(["Bread"]);
  });

  it("quietly ignores an item that no longer exists", async () => {
    await expect(toggleListItem(formData({ itemId: "missing" }))).resolves.toBeUndefined();
    await expect(deleteListItem(formData({ itemId: "missing" }))).resolves.toBeUndefined();
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

    expect(result).toEqual({ ok: false, error: '"Milk" is already on the list.' });
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

  it("ignores an item that no longer exists", async () => {
    await expect(restoreListItem(formData({ itemId: "missing" }))).resolves.toBeUndefined();
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
    const inList = await prisma.listItem.findMany({
      where: { listId: list.id },
      orderBy: { position: "asc" },
    });
    expect(inList.map((item) => item.text).slice(0, 2)).toEqual(["Three", "One"]);
  });

  it("does nothing when given no ids", async () => {
    const { list } = await threeItems();

    await reorderListItems(formData({ listId: list.id, itemIds: "" }));

    expect(await order()).toEqual(["One", "Two", "Three"]);
  });
});
