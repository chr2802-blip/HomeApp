import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/lists/[id]/version/route";
import {
  addListItem,
  createListCategory,
  deleteListCategory,
  moveListCategory,
  moveListItemCategory,
  renameListCategory,
  restoreListItem,
} from "@/app/actions/lists";
import { POST } from "@/app/api/lists/sync/route";
import {
  createHome,
  createHomeWithMembers,
  createList as seedList,
  createUser,
  formData,
  signIn,
  submit,
} from "../helpers/factories";
import { expectDenied } from "../helpers/expect";

/**
 * A list sorted under headings of its own: the headings belong to the one list, an item is
 * filed under one of them or none, and deleting one leaves its items on the list.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const ownList = async (title = "Cabin") => {
  const list = await seedList({ homeId: home.id, createdById: member.id, title });
  return prisma.list.update({ where: { id: list.id }, data: { grouping: "OWN" } });
};

const headings = (listId: string) =>
  prisma.listCategory.findMany({ where: { listId }, orderBy: { position: "asc" } });

const names = async (listId: string) => (await headings(listId)).map((category) => category.name);

describe("a list's own categories", () => {
  it("are added last in the list's order, and belong to that list alone", async () => {
    const cabin = await ownList();
    const party = await ownList("Party");

    expect((await submit(createListCategory, { listId: cabin.id, name: "Hardware" }))?.ok).toBe(true);
    expect((await submit(createListCategory, { listId: cabin.id, name: "Chemist" }))?.ok).toBe(true);
    // The same name on another list is another heading, not a duplicate.
    expect((await submit(createListCategory, { listId: party.id, name: "Hardware" }))?.ok).toBe(true);

    expect(await names(cabin.id)).toEqual(["Hardware", "Chemist"]);
    expect(await names(party.id)).toEqual(["Hardware"]);
  });

  it("refuses a blank name, and a name the list already has whatever its capitals", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });

    expect((await submit(createListCategory, { listId: list.id, name: "  " }))?.ok).toBe(false);
    const clash = await submit(createListCategory, { listId: list.id, name: "hardware" });
    expect(clash?.ok).toBe(false);
    expect(await names(list.id)).toEqual(["Hardware"]);
  });

  it("are renamed, and a rename onto another heading's name is refused", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    await submit(createListCategory, { listId: list.id, name: "Chemist" });
    const [hardware] = await headings(list.id);

    expect((await submit(renameListCategory, { categoryId: hardware!.id, name: "DIY store" }))?.ok).toBe(true);
    expect((await submit(renameListCategory, { categoryId: hardware!.id, name: "chemist" }))?.ok).toBe(false);
    expect(await names(list.id)).toEqual(["DIY store", "Chemist"]);
  });

  it("move one step at a time, and not past either end", async () => {
    const list = await ownList();
    for (const name of ["A", "B", "C"]) await submit(createListCategory, { listId: list.id, name });
    const [a, , c] = await headings(list.id);

    await moveListCategory(formData({ categoryId: c!.id, direction: "up" }));
    expect(await names(list.id)).toEqual(["A", "C", "B"]);
    await moveListCategory(formData({ categoryId: a!.id, direction: "up" }));
    expect(await names(list.id)).toEqual(["A", "C", "B"]);
    await moveListCategory(formData({ categoryId: a!.id, direction: "down" }));
    expect(await names(list.id)).toEqual(["C", "A", "B"]);
  });

  it("leave their items on the list, unsorted, when deleted", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    const [hardware] = await headings(list.id);
    const screws = await prisma.listItem.create({
      data: { listId: list.id, text: "Screws", position: 1, categoryId: hardware!.id },
    });

    await deleteListCategory(formData({ categoryId: hardware!.id }));

    expect(await headings(list.id)).toEqual([]);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: screws.id } })).categoryId).toBeNull();
  });

  it("go with their list", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    await prisma.list.delete({ where: { id: list.id } });
    expect(await prisma.listCategory.count()).toBe(0);
  });

  it("cannot be reached from another home", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    const [hardware] = await headings(list.id);
    const stranger = await createUser({ homeId: (await createHome()).id });

    await signIn(stranger);
    await expectDenied(() => submit(createListCategory, { listId: list.id, name: "Mine" }));
    await expectDenied(() => submit(renameListCategory, { categoryId: hardware!.id, name: "Mine" }));
    await expectDenied(() => deleteListCategory(formData({ categoryId: hardware!.id })));
    await expectDenied(() => moveListCategory(formData({ categoryId: hardware!.id, direction: "up" })));
    expect(await names(list.id)).toEqual(["Hardware"]);
  });
});

describe("filing an item", () => {
  it("moves it under one of its own list's headings, or back under none", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    const [hardware] = await headings(list.id);
    const screws = await prisma.listItem.create({ data: { listId: list.id, text: "Screws", position: 1 } });
    const filed = async () =>
      (await prisma.listItem.findUniqueOrThrow({ where: { id: screws.id } })).categoryId;

    await moveListItemCategory(formData({ itemId: screws.id, categoryId: hardware!.id }));
    expect(await filed()).toBe(hardware!.id);
    await moveListItemCategory(formData({ itemId: screws.id, categoryId: "" }));
    expect(await filed()).toBeNull();
  });

  it("ignores a heading from another list", async () => {
    const list = await ownList();
    const other = await ownList("Party");
    await submit(createListCategory, { listId: other.id, name: "Balloons" });
    const [balloons] = await headings(other.id);
    const screws = await prisma.listItem.create({ data: { listId: list.id, text: "Screws", position: 1 } });

    await moveListItemCategory(formData({ itemId: screws.id, categoryId: balloons!.id }));
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: screws.id } })).categoryId).toBeNull();
  });

  it("adds an item under the heading the add box stood on, and brings a ticked one back under it", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    await submit(createListCategory, { listId: list.id, name: "Chemist" });
    const [hardware, chemist] = await headings(list.id);
    const plasters = await prisma.listItem.create({
      data: { listId: list.id, text: "Plasters", position: 1, done: true, categoryId: chemist!.id },
    });

    await submit(addListItem, { listId: list.id, text: "Screws", categoryId: hardware!.id });
    // Asked for nothing in particular, a ticked item comes back under the heading it had.
    await submit(addListItem, { listId: list.id, text: "Plasters" });

    const items = await prisma.listItem.findMany({ where: { listId: list.id }, orderBy: { text: "asc" } });
    expect(items.map((item) => [item.text, item.done, item.categoryId])).toEqual([
      ["Plasters", false, chemist!.id],
      ["Screws", false, hardware!.id],
    ]);

    await prisma.listItem.update({ where: { id: plasters.id }, data: { done: true } });
    await restoreListItem(formData({ itemId: plasters.id, categoryId: hardware!.id }));
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: plasters.id } })).categoryId).toBe(
      hardware!.id,
    );
  });

  it("adds a queued item under its heading, and unsorted when the heading has gone", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    const [hardware] = await headings(list.id);
    const op = (itemId: string, text: string, categoryId: string) => ({
      id: `op-${itemId}`,
      kind: "add" as const,
      listId: list.id,
      itemId,
      text,
      amount: 1,
      categoryId,
    });

    await POST(
      new Request("http://localhost/api/lists/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: [op("i1", "Screws", hardware!.id), op("i2", "Rope", "gone")] }),
      }),
    );

    const items = await prisma.listItem.findMany({ where: { listId: list.id }, orderBy: { text: "asc" } });
    expect(items.map((item) => [item.text, item.categoryId])).toEqual([
      ["Rope", null],
      ["Screws", hardware!.id],
    ]);
  });

  it("is a change the other phone's list notices, as is renaming a heading", async () => {
    const list = await ownList();
    await submit(createListCategory, { listId: list.id, name: "Hardware" });
    const [hardware] = await headings(list.id);
    const screws = await prisma.listItem.create({ data: { listId: list.id, text: "Screws", position: 1 } });
    const ask = async () => {
      const response = await GET(new Request(`http://localhost/api/lists/${list.id}/version`), {
        params: Promise.resolve({ id: list.id }),
      });
      return ((await response.json()) as { version: string }).version;
    };

    const before = await ask();
    await moveListItemCategory(formData({ itemId: screws.id, categoryId: hardware!.id }));
    const moved = await ask();
    expect(moved).not.toBe(before);
    await submit(renameListCategory, { categoryId: hardware!.id, name: "DIY" });
    expect(await ask()).not.toBe(moved);
  });
});
