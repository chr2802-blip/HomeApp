import { beforeEach, describe, expect, it, vi } from "vitest";

const { sortPantryGoods } = vi.hoisted(() => ({ sortPantryGoods: vi.fn() }));
vi.mock("@/lib/pantry-sort", () => ({ sortPantryGoods, MAX_GOODS_PER_SORT: 60 }));

import { prisma } from "@/lib/prisma";
import { createPantryShelf, deletePantryShelf, renamePantryShelf } from "@/app/actions/pantry-shelves";
import { createPantryItem, editPantryItem, sortPantry } from "@/app/actions/pantry";
import { createHome, createHomeWithMembers, formData, signIn, submit } from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";

/**
 * A household's own pantry shelves. Kept by its admins, filed onto by anybody, and
 * holding an entry by `shelfId` — never beside a built-in `category`, which is the
 * invariant every write here has to keep.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  sortPantryGoods.mockReset();
  ({ home, admin, member } = await createHomeWithMembers());
  await signIn(admin);
});

const shelfNamed = (name: string) => prisma.pantryShelf.findFirstOrThrow({ where: { homeId: home.id, name } });
const entry = (name: string) => prisma.pantryItem.findFirstOrThrow({ where: { homeId: home.id, name } });

describe("keeping the shelves", () => {
  it("adds, renames and refuses a name already taken — the built-ins' included", async () => {
    expect(await submit(createPantryShelf, { name: "  Snacks " })).toEqual({ ok: true });
    expect(await submit(createPantryShelf, { name: "snacks" })).toMatchObject({ ok: false });
    // A built-in shelf's name, in either language and any capitals.
    expect(await submit(createPantryShelf, { name: "køleskab" })).toMatchObject({ ok: false });
    expect(await submit(createPantryShelf, { name: "" })).toMatchObject({ ok: false });

    const snacks = await shelfNamed("Snacks");
    expect(await submit(renamePantryShelf, { shelfId: snacks.id, name: "Treats" })).toEqual({ ok: true });
    expect((await prisma.pantryShelf.findUniqueOrThrow({ where: { id: snacks.id } })).name).toBe("Treats");
    // Renaming to its own name in other capitals is not a clash with itself.
    expect(await submit(renamePantryShelf, { shelfId: snacks.id, name: "TREATS" })).toEqual({ ok: true });
  });

  it("is administration: a plain member is turned away", async () => {
    await signIn(member);
    await expectRedirect(() => submit(createPantryShelf, { name: "Snacks" }), "/dashboard");
    expect(await prisma.pantryShelf.count()).toBe(0);
  });

  it("cannot reach another home's shelf", async () => {
    const other = await createHome({ name: "Elsewhere" });
    const theirs = await prisma.pantryShelf.create({ data: { homeId: other.id, name: "Theirs" } });

    expect(await submit(renamePantryShelf, { shelfId: theirs.id, name: "Mine" })).toMatchObject({ ok: false });
    await deletePantryShelf(formData({ shelfId: theirs.id }));
    expect(await prisma.pantryShelf.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });
});

describe("filing onto a household's own shelf", () => {
  beforeEach(async () => {
    await submit(createPantryShelf, { name: "Snacks" });
    await signIn(member);
  });

  it("files an entry there from the add sheet, and never beside a built-in shelf", async () => {
    const snacks = await shelfNamed("Snacks");
    // Salt is a good the free list knows; the household's choice still wins.
    await submit(createPantryItem, { name: "Salt", category: snacks.id });
    expect(await entry("Salt")).toMatchObject({ shelfId: snacks.id, category: null });
  });

  it("moves between a built-in shelf and an own one, writing both columns", async () => {
    const snacks = await shelfNamed("Snacks");
    await submit(createPantryItem, { name: "Salt" });
    const salt = await entry("Salt");
    expect(salt).toMatchObject({ category: "SPICES", shelfId: null });

    await submit(editPantryItem, { pantryItemId: salt.id, category: snacks.id, unit: "" });
    expect(await entry("Salt")).toMatchObject({ category: null, shelfId: snacks.id });

    await submit(editPantryItem, { pantryItemId: salt.id, category: "SPICES", unit: "" });
    expect(await entry("Salt")).toMatchObject({ category: "SPICES", shelfId: null });
  });

  it("treats another home's shelf id as no choice at all", async () => {
    const other = await createHome({ name: "Elsewhere" });
    const theirs = await prisma.pantryShelf.create({ data: { homeId: other.id, name: "Theirs" } });

    await submit(createPantryItem, { name: "Salt", category: theirs.id });
    expect(await entry("Salt")).toMatchObject({ category: "SPICES", shelfId: null });
  });

  it("never sends what is on an own shelf to be sorted", async () => {
    const snacks = await shelfNamed("Snacks");
    await submit(createPantryItem, { name: "Gochujang", category: snacks.id });

    expect(await sortPantry()).toEqual({ ok: true });
    expect(sortPantryGoods).not.toHaveBeenCalled();
    expect(await entry("Gochujang")).toMatchObject({ shelfId: snacks.id, category: null });
  });

  it("hands what was on a deleted shelf back to 'not sorted yet'", async () => {
    const snacks = await shelfNamed("Snacks");
    await submit(createPantryItem, { name: "Gochujang", category: snacks.id });

    await signIn(admin);
    await deletePantryShelf(formData({ shelfId: snacks.id }));

    expect(await prisma.pantryShelf.count()).toBe(0);
    expect(await entry("Gochujang")).toMatchObject({ shelfId: null, category: null });
  });
});
