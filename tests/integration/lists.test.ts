import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addListItem,
  clearCompletedItems,
  createList,
  deleteList,
  deleteListItem,
  renameList,
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
