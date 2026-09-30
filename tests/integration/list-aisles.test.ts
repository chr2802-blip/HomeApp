import { beforeEach, describe, expect, it, vi } from "vitest";

/** The model's half of placing items, answered here. */
const { sortShopAisles } = vi.hoisted(() => ({ sortShopAisles: vi.fn() }));
vi.mock("@/lib/aisle-sort", () => ({ sortShopAisles, MAX_ITEMS_PER_AISLE_SORT: 60 }));
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/lists/[id]/version/route";
import { createList, moveListItemAisle, sortListAisles, updateList } from "@/app/actions/lists";
import {
  createHome,
  createHomeWithMembers,
  createList as seedList,
  createUser,
  formData,
  signIn,
  submit,
} from "../helpers/factories";
import { captureRedirect, expectDenied } from "../helpers/expect";

/**
 * A list drawn under the shop's aisles: the setting, the household's own word on where
 * something is bought, and the model asked about only what nobody could place.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  sortShopAisles.mockReset();
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const groupedList = async () => {
  const list = await seedList({ homeId: home.id, createdById: member.id });
  return prisma.list.update({ where: { id: list.id }, data: { groupByAisle: true } });
};

const item = (listId: string, text: string, done = false) =>
  prisma.listItem.create({ data: { listId, text, done, position: 1 } });

describe("the list's setting", () => {
  it("is off unless asked for, and is kept by create and edit alike", async () => {
    await captureRedirect(() => createList(undefined, formData({ title: "Packing" })));
    await captureRedirect(() => createList(undefined, formData({ title: "Shop", groupByAisle: "on" })));
    const lists = await prisma.list.findMany({ where: { homeId: home.id }, orderBy: { title: "asc" } });
    expect(lists.map((list) => [list.title, list.groupByAisle])).toEqual([
      ["Packing", false],
      ["Shop", true],
    ]);

    const shop = lists[1]!;
    expect((await submit(updateList, { listId: shop.id, title: "Shop" }))?.ok).toBe(true);
    expect((await prisma.list.findUniqueOrThrow({ where: { id: shop.id } })).groupByAisle).toBe(false);
  });
});

describe("moveListItemAisle", () => {
  it("remembers the aisle for the home by the item's key, and a second move replaces it", async () => {
    const list = await groupedList();
    const eggs = await item(list.id, "6 æg");

    await moveListItemAisle(formData({ itemId: eggs.id, aisle: "BAKERY" }));
    await moveListItemAisle(formData({ itemId: eggs.id, aisle: "FROZEN" }));

    const rows = await prisma.aisleChoice.findMany({ where: { homeId: home.id } });
    expect(rows.map((row) => [row.key, row.aisle])).toEqual([["æg", "FROZEN"]]);
  });

  it("ignores an aisle that does not exist", async () => {
    const list = await groupedList();
    const eggs = await item(list.id, "Æg");
    await moveListItemAisle(formData({ itemId: eggs.id, aisle: "GARDEN" }));
    expect(await prisma.aisleChoice.count()).toBe(0);
  });

  it("refuses another home's item", async () => {
    const other = await createHome();
    const stranger = await createUser({ homeId: other.id });
    const list = await groupedList();
    const eggs = await item(list.id, "Æg");

    await signIn(stranger);
    await expectDenied(() => moveListItemAisle(formData({ itemId: eggs.id, aisle: "BAKERY" })));
    expect(await prisma.aisleChoice.count()).toBe(0);
  });

  it("is a change the other phone's list notices", async () => {
    const list = await groupedList();
    const eggs = await item(list.id, "Æg");
    const ask = async () => {
      const response = await GET(new Request(`http://localhost/api/lists/${list.id}/version`), {
        params: Promise.resolve({ id: list.id }),
      });
      return ((await response.json()) as { version: string }).version;
    };

    const before = await ask();
    await moveListItemAisle(formData({ itemId: eggs.id, aisle: "BAKERY" }));
    expect(await ask()).not.toBe(before);
  });
});

describe("sortListAisles", () => {
  it("asks the model only about open items nobody has placed, and remembers the answers", async () => {
    const list = await groupedList();
    await item(list.id, "Bananer");
    await item(list.id, "Gochujang");
    await item(list.id, "Panko");
    await item(list.id, "Za'atar", true);
    await prisma.aisleChoice.create({ data: { homeId: home.id, key: "panko", aisle: "DRY_GOODS" } });
    sortShopAisles.mockResolvedValue({ ok: true, aisles: new Map([[0, "SPICES_SAUCES"]]) });

    await sortListAisles(formData({ listId: list.id }));

    expect(sortShopAisles).toHaveBeenCalledWith(["Gochujang"], home.id);
    const rows = await prisma.aisleChoice.findMany({ where: { homeId: home.id }, orderBy: { key: "asc" } });
    expect(rows.map((row) => [row.key, row.aisle])).toEqual([
      ["gochujang", "SPICES_SAUCES"],
      ["panko", "DRY_GOODS"],
    ]);
  });

  it("never overrules an aisle somebody chose by hand while the model was thinking", async () => {
    const list = await groupedList();
    await item(list.id, "Gochujang");
    sortShopAisles.mockImplementation(async () => {
      await prisma.aisleChoice.create({ data: { homeId: home.id, key: "gochujang", aisle: "OTHER" } });
      return { ok: true, aisles: new Map([[0, "SPICES_SAUCES"]]) };
    });

    await sortListAisles(formData({ listId: list.id }));

    expect((await prisma.aisleChoice.findFirstOrThrow()).aisle).toBe("OTHER");
  });

  it("asks nothing for a list that is not grouped, or has nothing unplaced", async () => {
    const plain = await seedList({ homeId: home.id, createdById: member.id });
    await item(plain.id, "Gochujang");
    await sortListAisles(formData({ listId: plain.id }));

    const grouped = await groupedList();
    await item(grouped.id, "Mælk");
    await sortListAisles(formData({ listId: grouped.id }));

    expect(sortShopAisles).not.toHaveBeenCalled();
  });

  it("writes nothing when the model is down", async () => {
    const list = await groupedList();
    await item(list.id, "Gochujang");
    sortShopAisles.mockResolvedValue({ ok: false, reason: "unavailable" });

    await sortListAisles(formData({ listId: list.id }));

    expect(await prisma.aisleChoice.count()).toBe(0);
  });
});
