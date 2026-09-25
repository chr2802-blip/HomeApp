import { beforeEach, describe, expect, it, vi } from "vitest";

/** The model's half of sorting, answered here — see "filing things on shelves" below. */
const { sortPantryGoods } = vi.hoisted(() => ({ sortPantryGoods: vi.fn() }));
vi.mock("@/lib/pantry-sort", () => ({ sortPantryGoods, MAX_GOODS_PER_SORT: 60 }));
import { prisma } from "@/lib/prisma";
import {
  addPantryToList,
  createPantryItem,
  deletePantryItem,
  editPantryItem,
  renamePantryItem,
  setPantryQuantity,
  sortPantry,
} from "@/app/actions/pantry";
import { addListItem, addMealPlanIngredients, addRecipeIngredients } from "@/app/actions/lists";
import { planMeal } from "@/app/actions/meals";
import { weekDays, weekStartInZone } from "@/lib/time";
import { PANTRY_CONFIRM_FIELD, PANTRY_KEEP_FIELD } from "@/lib/pantry";
import {
  createHome,
  createHomeWithMembers,
  createUser,
  createList as seedList,
  createRecipe,
  formData,
  signIn,
  submit,
} from "../helpers/factories";
import { expectDenied } from "../helpers/expect";

/**
 * The household's basic goods, and the one thing they are for: keeping salt off the
 * shopping list.
 *
 * Two halves are pinned down here. The entries themselves — anybody in the home may keep
 * them, one per row of shopping, and a rename moves what the entry matches — and what a
 * recipe run does with them, which is where the feature either works or is a page nobody
 * can see the effect of.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  sortPantryGoods.mockReset();
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const listFor = (title = "Shopping") =>
  seedList({ homeId: home.id, createdById: member.id, title });

const recipeFor = (options: { title?: string; ingredients?: string }) =>
  createRecipe({ homeId: home.id, createdById: member.id, ...options });

const keepIn = (name: string, quantity = 1) =>
  createPantryItem(undefined, formData({ name })).then(async () => {
    if (quantity !== 1) {
      const item = await prisma.pantryItem.findFirstOrThrow({ where: { homeId: home.id, name } });
      await setPantryQuantity(formData({ pantryItemId: item.id, quantity: String(quantity) }));
    }
  });

const textsOnList = async () =>
  (await prisma.listItem.findMany({ orderBy: { position: "asc" } })).map((item) => item.text);

describe("keeping the pantry", () => {
  it("is an ordinary member's to keep, not only an admin's", async () => {
    // Deliberately the plain member rather than the admin the other settings tests sign
    // in as: whoever finds the rice jar empty is who has to be able to say so.
    expect(await submit(createPantryItem, { name: "Kiks" })).toEqual({ ok: true });

    expect(await prisma.pantryItem.findFirstOrThrow()).toMatchObject({
      name: "Kiks",
      homeId: home.id,
      quantity: 1,
      unit: null,
      category: null,
    });
  });

  it("stores the name as written and the key the shopping list will match", async () => {
    await submit(createPantryItem, { name: "  Olivenolie  " });

    expect(await prisma.pantryItem.findFirstOrThrow()).toMatchObject({
      name: "Olivenolie",
      key: "olivenolie",
    });
  });

  it("refuses a blank name, and one that was only an amount", async () => {
    expect(await submit(createPantryItem, { name: "   " })).toEqual({
      ok: false,
      error: "Write what you keep in.",
    });
    expect(await submit(createPantryItem, { name: "," })).toEqual({
      ok: false,
      error: "Write what it is called, not how much of it.",
    });
    expect(await prisma.pantryItem.count()).toBe(0);
  });

  // "Salt" and "salt" are not two basic goods, which is why the unique index is on the
  // key rather than on the name.
  it("refuses a second entry for the same row of shopping", async () => {
    await submit(createPantryItem, { name: "Salt" });

    expect(await submit(createPantryItem, { name: "salt" })).toEqual({
      ok: false,
      error: "“salt” is already in the pantry.",
    });
    expect(await prisma.pantryItem.count()).toBe(1);
  });

  it("lets another home keep the same thing", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    await prisma.pantryItem.create({ data: { homeId: neighbour.id, name: "Salt", key: "salt" } });

    expect(await submit(createPantryItem, { name: "Salt" })).toEqual({ ok: true });
    expect(await prisma.pantryItem.count()).toBe(2);
  });

  it("moves what an entry matches when it is renamed", async () => {
    await submit(createPantryItem, { name: "Salt" });
    const item = await prisma.pantryItem.findFirstOrThrow();

    expect(await renamePantryItem(formData({ pantryItemId: item.id, name: "Sukker" }))).toEqual({
      ok: true,
    });

    // The key rewritten too. Left as it was, the entry would go on quietly answering for
    // salt from behind a name that says sugar — invisible from the page.
    expect(await prisma.pantryItem.findFirstOrThrow()).toMatchObject({
      name: "Sukker",
      key: "sukker",
    });
  });

  it("refuses a rename onto something the household already keeps", async () => {
    await submit(createPantryItem, { name: "Salt" });
    await submit(createPantryItem, { name: "Sukker" });
    const sukker = await prisma.pantryItem.findFirstOrThrow({ where: { name: "Sukker" } });

    expect(await renamePantryItem(formData({ pantryItemId: sukker.id, name: "salt" }))).toEqual({
      ok: false,
      error: "“salt” is already in the pantry.",
    });
    // Reported rather than thrown, because the row that was typed into is what puts the
    // name back and says why.
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { id: sukker.id } })).name).toBe(
      "Sukker",
    );
  });

  it("says how much the household has, and is told which quantity to land in", async () => {
    await submit(createPantryItem, { name: "Ris" });
    const item = await prisma.pantryItem.findFirstOrThrow();

    await setPantryQuantity(formData({ pantryItemId: item.id, quantity: "0" }));
    expect((await prisma.pantryItem.findFirstOrThrow()).quantity).toBe(0);

    // The same press arriving twice — a double tap, a retry — leaves the cupboard
    // saying what the thumb meant rather than applied again on top of itself.
    await setPantryQuantity(formData({ pantryItemId: item.id, quantity: "0" }));
    expect((await prisma.pantryItem.findFirstOrThrow()).quantity).toBe(0);
  });

  it("clamps a quantity to the floor of zero, and writes nothing but the quantity", async () => {
    await submit(createPantryItem, { name: "Ris" });
    const item = await prisma.pantryItem.findFirstOrThrow();
    expect(item.unit).toBe("KG");

    // A unit riding along is ignored: the unit belongs to the sheet behind the three dots
    // now, and a stepper that wrote the one it was drawn with would undo that sheet.
    await setPantryQuantity(formData({ pantryItemId: item.id, quantity: "-5", unit: "G" }));
    expect(await prisma.pantryItem.findFirstOrThrow()).toMatchObject({ quantity: 0, unit: "KG" });
  });

  it("drops an entry the household no longer treats as a basic", async () => {
    await submit(createPantryItem, { name: "Ris" });
    const item = await prisma.pantryItem.findFirstOrThrow();

    await deletePantryItem(formData({ pantryItemId: item.id }));
    expect(await prisma.pantryItem.count()).toBe(0);
  });

  it("cannot be reached from another household", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await prisma.pantryItem.create({
      data: { homeId: neighbour.id, name: "Salt", key: "salt" },
    });

    expect(await renamePantryItem(formData({ pantryItemId: theirs.id, name: "Sukker" }))).toEqual({
      ok: false,
      error: "That is no longer in the pantry.",
    });
    await deletePantryItem(formData({ pantryItemId: theirs.id }));
    await setPantryQuantity(formData({ pantryItemId: theirs.id, quantity: "0" }));
    expect(
      await submit(editPantryItem, { pantryItemId: theirs.id, category: "FREEZER", unit: "KG" }),
    ).toEqual({ ok: false, error: "That is no longer in the pantry." });
    // Sorting is this home's unsorted entries and nobody else's.
    await sortPantry();

    expect(await prisma.pantryItem.findUniqueOrThrow({ where: { id: theirs.id } })).toMatchObject({
      name: "Salt",
      quantity: 1,
      unit: null,
      category: null,
    });
  });

  it("goes with the home", async () => {
    await submit(createPantryItem, { name: "Salt" });
    await prisma.home.delete({ where: { id: home.id } });
    expect(await prisma.pantryItem.count()).toBe(0);
  });
});

describe("what the pantry does to a recipe's ingredients", () => {
  it("leaves out what the household has in, and says so", async () => {
    const list = await listFor();
    await keepIn("Salt");
    await keepIn("Olivenolie");
    const recipe = await recipeFor({
      ingredients: "2 tsk salt\n1 dl olivenolie\n500 g hakket oksekød",
    });

    const result = await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect(await textsOnList()).toEqual(["Hakket oksekød"]);
    expect(result).toEqual({ ok: true, note: "Salt and Olivenolie already in the pantry." });
  });

  // The second half of the boolean, and the reason running out is an untick rather than
  // a delete: the line comes straight back onto the shopping.
  it("puts back what the household has run out of", async () => {
    const list = await listFor();
    await keepIn("Salt");
    await keepIn("Ris", 0);
    const recipe = await recipeFor({ ingredients: "Salt\nRis" });

    expect(await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }))).toEqual({
      ok: true,
      note: "Salt already in the pantry.",
    });
    expect(await textsOnList()).toEqual(["Ris"]);
  });

  it("says plainly when there was nothing left to add", async () => {
    const list = await listFor();
    await keepIn("Salt");
    const recipe = await recipeFor({ ingredients: "Salt" });

    expect(await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }))).toEqual({
      ok: false,
      error: "Nothing to add — the pantry already has all of it.",
    });
    // Nothing written, and no note left behind pointing at a recipe that added nothing.
    expect(await prisma.listItem.count()).toBe(0);
    expect(await prisma.listItemSource.count()).toBe(0);
  });

  it("does not bump something already on the list either", async () => {
    const list = await listFor();
    await keepIn("Salt");
    await prisma.listItem.create({ data: { listId: list.id, text: "Salt", position: 1 } });
    const recipe = await recipeFor({ ingredients: "Salt\nRis" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect(await prisma.listItem.findFirstOrThrow({ where: { text: "Salt" } })).toMatchObject({
      amount: 1,
    });
  });

  // Typing something into the add box is somebody asking for it on purpose. The pantry
  // answers what a recipe assumed, never what a person asked for.
  it("has nothing to say about a line somebody typed", async () => {
    const list = await listFor();
    await keepIn("Salt");

    expect(await submit(addListItem, { listId: list.id, text: "Salt" })).toEqual({ ok: true });
    expect(await textsOnList()).toEqual(["Salt"]);
  });

  it("answers for a whole week's cooking the same way", async () => {
    const list = await listFor();
    await keepIn("Salt");
    const monday = weekStartInZone(new Date());
    const [tuesday, wednesday] = weekDays(monday).slice(1, 3);
    const stew = await recipeFor({ title: "Stew", ingredients: "Salt\nOksekød" });
    const soup = await recipeFor({ title: "Soup", ingredients: "2 tsk salt\nGulerødder" });

    await submit(planMeal, { date: tuesday, plan: stew.id });
    await submit(planMeal, { date: wednesday, plan: soup.id });

    const result = await addMealPlanIngredients(formData({ listId: list.id, week: monday }));

    // Named once across the run, however many of the week's recipes wanted it.
    expect(result).toEqual({ ok: true, note: "Salt already in the pantry." });
    expect((await textsOnList()).sort()).toEqual(["Gulerødder", "Oksekød"]);
  });

  // A line naming more than one thing is not a second opinion about what the pantry
  // matches — every part is still checked, just against each half of the line.
  it("answers for a combined line where every part is stocked, with nothing to ask", async () => {
    const list = await listFor();
    await keepIn("Salt");
    await keepIn("Peber");
    const recipe = await recipeFor({ ingredients: "Salt og peber\nHakket oksekød" });

    const result = await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect(await textsOnList()).toEqual(["Hakket oksekød"]);
    expect(result).toEqual({ ok: true, note: "Salt og peber already in the pantry." });
  });

  describe("a combined line the pantry only partly answers for", () => {
    it("asks rather than guessing, and writes nothing yet", async () => {
      const list = await listFor();
      await keepIn("Salt");
      const recipe = await recipeFor({ ingredients: "Salt og peber\nHakket oksekød" });

      const result = await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

      expect(result).toEqual({
        needsDecision: true,
        lines: [{ key: "salt og peber", text: "Salt og peber", matched: ["Salt"] }],
      });
      expect(await prisma.listItem.count()).toBe(0);
    });

    it("leaves the line off once told to, the same as a covered line", async () => {
      const list = await listFor();
      await keepIn("Salt");
      const recipe = await recipeFor({ ingredients: "Salt og peber\nHakket oksekød" });

      const result = await addRecipeIngredients(
        formData({
          recipeId: recipe.id,
          listId: list.id,
          [PANTRY_CONFIRM_FIELD]: "1",
        }),
      );

      expect(await textsOnList()).toEqual(["Hakket oksekød"]);
      expect(result).toEqual({ ok: true, note: "Salt og peber already in the pantry." });
    });

    it("adds the line whole once told to keep it", async () => {
      const list = await listFor();
      await keepIn("Salt");
      const recipe = await recipeFor({ ingredients: "Salt og peber\nHakket oksekød" });

      const result = await addRecipeIngredients(
        formData({
          recipeId: recipe.id,
          listId: list.id,
          [PANTRY_CONFIRM_FIELD]: "1",
          [PANTRY_KEEP_FIELD]: "salt og peber",
        }),
      );

      expect((await textsOnList()).sort()).toEqual(["Hakket oksekød", "Salt og peber"]);
      expect(result).toEqual({ ok: true });
    });
  });
});

describe("putting what has run out on a list", () => {
  it("adds everything switched off, and nothing that is still in", async () => {
    const list = await listFor();
    await keepIn("Salt");
    await keepIn("Ris", 0);
    await keepIn("Mel", 0);

    expect(await addPantryToList(formData({ listId: list.id }))).toEqual({ ok: true });

    expect(await textsOnList()).toEqual(["Mel", "Ris"]);
    // A list is a plan, not a receipt: nothing has been bought yet, so the cupboard
    // still says what it said.
    expect(await prisma.pantryItem.count({ where: { quantity: 0 } })).toBe(2);
  });

  it("brings back a row that was ticked off rather than writing a second one", async () => {
    const list = await listFor();
    await keepIn("Ris", 0);
    await prisma.listItem.create({ data: { listId: list.id, text: "Ris", done: true, position: 1 } });

    expect(await addPantryToList(formData({ listId: list.id }))).toEqual({ ok: true });

    const items = await prisma.listItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Ris", done: false, amount: 1 });
  });

  it("leaves a row already on the list exactly as it is, and says so", async () => {
    const list = await listFor();
    await keepIn("Ris", 0);
    await keepIn("Mel", 0);
    await prisma.listItem.create({ data: { listId: list.id, text: "Ris", amount: 3, position: 1 } });

    // Being out of rice is not a reason to buy two of it.
    expect(await addPantryToList(formData({ listId: list.id }))).toEqual({
      ok: true,
      note: "Ris already on the list.",
    });
    expect(await prisma.listItem.findFirstOrThrow({ where: { text: "Ris" } })).toMatchObject({
      amount: 3,
    });
  });

  it("says plainly when there is nothing to add", async () => {
    const list = await listFor();
    await keepIn("Salt");

    expect(await addPantryToList(formData({ listId: list.id }))).toEqual({
      ok: false,
      error: "Nothing in the pantry has run out.",
    });

    await keepIn("Ris", 0);
    await addPantryToList(formData({ listId: list.id }));

    expect(await addPantryToList(formData({ listId: list.id }))).toEqual({
      ok: false,
      error: "Everything that has run out is already on the list.",
    });
    expect(await prisma.listItem.count()).toBe(1);
  });

  it("cannot write into another household's list", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const stranger = await createUser({ homeId: neighbour.id });
    const theirs = await seedList({ homeId: neighbour.id, createdById: stranger.id });
    await keepIn("Ris", 0);

    await expectDenied(() => addPantryToList(formData({ listId: theirs.id })));
    expect(await prisma.listItem.count()).toBe(0);
  });
});

describe("filing things on shelves", () => {
  const entry = (name: string) =>
    prisma.pantryItem.findFirstOrThrow({ where: { homeId: home.id, name } });

  it("files a good the list knows the moment it is added, with its usual unit", async () => {
    await submit(createPantryItem, { name: "Spidskommen" });
    // Either language, and a qualifier in front is still the same good.
    await submit(createPantryItem, { name: "Olive oil" });
    await submit(createPantryItem, { name: "Røget paprika" });

    expect(await entry("Spidskommen")).toMatchObject({ category: "SPICES", unit: "JAR", quantity: 1 });
    expect(await entry("Olive oil")).toMatchObject({ category: "OIL_VINEGAR", unit: "L" });
    expect(await entry("Røget paprika")).toMatchObject({ category: "SPICES" });
    expect(sortPantryGoods).not.toHaveBeenCalled();
  });

  it("takes the shelf the household chose over the one the list would have", async () => {
    await submit(createPantryItem, { name: "Smør", category: "FREEZER" });
    expect(await entry("Smør")).toMatchObject({ category: "FREEZER", unit: "PACK" });

    // And one it does not offer is no choice at all, so the list decides.
    await submit(createPantryItem, { name: "Mælk", category: "CELLAR" });
    expect(await entry("Mælk")).toMatchObject({ category: "FRIDGE" });
  });

  it("changes the shelf and the unit from the sheet, holding both to what is offered", async () => {
    await submit(createPantryItem, { name: "Kiks" });
    const item = await entry("Kiks");

    expect(
      await submit(editPantryItem, { pantryItemId: item.id, category: "DRY_GOODS", unit: "PACK" }),
    ).toEqual({ ok: true });
    expect(await entry("Kiks")).toMatchObject({ category: "DRY_GOODS", unit: "PACK" });

    // An empty unit is "no unit", a real answer; an unknown one is dropped to it.
    await submit(editPantryItem, { pantryItemId: item.id, category: "DRY_GOODS", unit: "bogus" });
    expect((await entry("Kiks")).unit).toBeNull();

    // A shelf that did not arrive leaves the entry where it was.
    await submit(editPantryItem, { pantryItemId: item.id, unit: "BAG" });
    expect(await entry("Kiks")).toMatchObject({ category: "DRY_GOODS", unit: "BAG" });
  });

  it("sorts what the list knows for free, and asks the model only about the rest", async () => {
    // Stored as entries kept before shelves existed would have been.
    for (const name of ["Salt", "Gochujang", "Panko"]) {
      await prisma.pantryItem.create({ data: { homeId: home.id, name, key: name.toLowerCase() } });
    }
    sortPantryGoods.mockResolvedValue({
      ok: true,
      categories: new Map([
        [0, "SAUCES"],
        [1, "DRY_GOODS"],
      ]),
    });

    expect(await sortPantry()).toEqual({ ok: true });

    expect(sortPantryGoods).toHaveBeenCalledWith(["Gochujang", "Panko"], home.id);
    expect(await entry("Salt")).toMatchObject({ category: "SPICES", unit: null });
    expect(await entry("Gochujang")).toMatchObject({ category: "SAUCES" });
    expect(await entry("Panko")).toMatchObject({ category: "DRY_GOODS" });
  });

  it("never spends a call when there is nothing the list does not know", async () => {
    await prisma.pantryItem.create({ data: { homeId: home.id, name: "Ris", key: "ris" } });

    expect(await sortPantry()).toEqual({ ok: true });
    expect(sortPantryGoods).not.toHaveBeenCalled();
    expect((await entry("Ris")).category).toBe("DRY_GOODS");
  });

  it("still files what it can when the model is down, and says so", async () => {
    await prisma.pantryItem.create({ data: { homeId: home.id, name: "Salt", key: "salt" } });
    await prisma.pantryItem.create({ data: { homeId: home.id, name: "Za'atar", key: "za'atar" } });
    sortPantryGoods.mockResolvedValue({ ok: false, reason: "unavailable" });

    const outcome = await sortPantry();

    expect(outcome?.ok).toBe(false);
    expect((await entry("Salt")).category).toBe("SPICES");
    expect((await entry("Za'atar")).category).toBeNull();
  });

  it("never overrules a shelf somebody chose while the model was thinking", async () => {
    const item = await prisma.pantryItem.create({ data: { homeId: home.id, name: "Panko", key: "panko" } });
    sortPantryGoods.mockImplementation(async () => {
      await prisma.pantryItem.update({ where: { id: item.id }, data: { category: "BAKING" } });
      return { ok: true, categories: new Map([[0, "DRY_GOODS"]]) };
    });

    await sortPantry();
    expect((await entry("Panko")).category).toBe("BAKING");
  });
});
