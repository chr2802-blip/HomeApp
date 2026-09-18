import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addRecipeIngredients, deleteListItem, toggleListItem } from "@/app/actions/lists";
import { deleteRecipe } from "@/app/actions/recipes";
import {
  createHome,
  createHomeWithMembers,
  createList as seedList,
  createRecipe,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { expectDenied, expectRedirect } from "../helpers/expect";

/**
 * A recipe's ingredients, put on a list.
 *
 * The behaviour worth pinning down here is what happens when the list already has
 * something to say about an ingredient: it is wanted once more rather than twice over,
 * a ticked-off row comes back rather than being written again, and each item remembers
 * which recipe asked for it until somebody ticks it off.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const listFor = (title = "Shopping") =>
  seedList({ homeId: home.id, createdById: member.id, title });

const recipeFor = (options: { title?: string; ingredients?: string }) =>
  createRecipe({ homeId: home.id, createdById: member.id, ...options });

/** What is on the list, in the order the page would draw it. */
const itemsOnList = () =>
  prisma.listItem.findMany({
    orderBy: [{ done: "asc" }, { position: "asc" }],
    include: { sources: { include: { recipe: { select: { title: true } } } } },
  });

const recipesBehind = async (text: string) => {
  const items = await itemsOnList();
  const item = items.find((one) => one.text === text);
  return item?.sources.map((source) => source.recipe.title).sort() ?? [];
};

describe("addRecipeIngredients", () => {
  it("puts every ingredient on the list, one of each", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "Flour\nMilk\nEggs" });

    const result = await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect(result).toEqual({ ok: true });
    const items = await itemsOnList();
    expect(items.map((item) => item.text)).toEqual(["Flour", "Milk", "Eggs"]);
    expect(items.map((item) => item.amount)).toEqual([1, 1, 1]);
    expect(items.every((item) => item.listId === list.id && !item.done)).toBe(true);
  });

  it("strips the amount and unit a line was written with before it lands on the list", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "2 løg, finthakket\n4 dl grøntsagsbouillon" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items.map((item) => item.text)).toEqual(["løg, finthakket", "grøntsagsbouillon"]);
    expect(items.map((item) => item.amount)).toEqual([1, 1]);
  });

  it("merges the same ingredient asked for in different amounts and units", async () => {
    const list = await listFor();
    const curry = await recipeFor({ title: "Curry", ingredients: "1 dl mælk" });
    const cake = await recipeFor({ title: "Cake", ingredients: "5 dl mælk" });

    await addRecipeIngredients(formData({ recipeId: curry.id, listId: list.id }));
    await addRecipeIngredients(formData({ recipeId: cake.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "mælk", amount: 2 });
    expect(await recipesBehind("mælk")).toEqual(["Cake", "Curry"]);
  });

  it("names the recipe under each item it added", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ title: "Lasagne", ingredients: "Mince\nPasta" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect(await recipesBehind("Mince")).toEqual(["Lasagne"]);
    expect(await recipesBehind("Pasta")).toEqual(["Lasagne"]);
  });

  it("lands after what is already on the list", async () => {
    const list = await listFor();
    await prisma.listItem.create({ data: { listId: list.id, text: "Coffee", position: 1 } });
    const recipe = await recipeFor({ ingredients: "Flour" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect((await itemsOnList()).map((item) => item.text)).toEqual(["Coffee", "Flour"]);
  });

  it("wants one more of something already on the list rather than a second copy", async () => {
    const list = await listFor();
    await prisma.listItem.create({ data: { listId: list.id, text: "Milk", position: 1 } });
    const recipe = await recipeFor({ title: "Pancakes", ingredients: "Milk" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Milk", amount: 2, done: false });
    // Even though the item was there first, it is now partly the pancakes' doing.
    expect(await recipesBehind("Milk")).toEqual(["Pancakes"]);
  });

  it("matches what is on the list however it was capitalised", async () => {
    const list = await listFor();
    await prisma.listItem.create({ data: { listId: list.id, text: "milk", position: 1 } });
    const recipe = await recipeFor({ ingredients: "Milk" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "milk", amount: 2 });
  });

  it("brings a ticked-off ingredient back, wanting one", async () => {
    const list = await listFor();
    await prisma.listItem.create({
      data: { listId: list.id, text: "Milk", amount: 4, done: true, position: 1 },
    });
    const recipe = await recipeFor({ title: "Pancakes", ingredients: "Milk" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    // Four is what was bought last time, not what this recipe needs.
    expect(items[0]).toMatchObject({ text: "Milk", amount: 1, done: false });
    expect(await recipesBehind("Milk")).toEqual(["Pancakes"]);
  });

  it("counts a recipe added twice twice over, and still names it once", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ title: "Pancakes", ingredients: "Flour\nMilk" });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));
    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items.map((item) => item.amount)).toEqual([2, 2]);
    expect(await recipesBehind("Flour")).toEqual(["Pancakes"]);
  });

  it("names both recipes when two of them want the same thing", async () => {
    const list = await listFor();
    const pancakes = await recipeFor({ title: "Pancakes", ingredients: "Milk\nFlour" });
    const risotto = await recipeFor({ title: "Risotto", ingredients: "Milk\nRice" });

    await addRecipeIngredients(formData({ recipeId: pancakes.id, listId: list.id }));
    await addRecipeIngredients(formData({ recipeId: risotto.id, listId: list.id }));

    expect(await recipesBehind("Milk")).toEqual(["Pancakes", "Risotto"]);
    expect(await recipesBehind("Rice")).toEqual(["Risotto"]);
    expect((await itemsOnList()).find((item) => item.text === "Milk")?.amount).toBe(2);
  });

  it("reads a line repeated inside one recipe as one ingredient", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "Salt\n\nSalt\n  salt  " });

    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Salt", amount: 1 });
  });

  it("says so, and writes nothing, when the recipe lists no ingredients", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "   \n  " });

    const result = await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    expect(result).toEqual({ ok: false, error: "This recipe has no ingredients to add yet." });
    expect(await prisma.listItem.count()).toBe(0);
  });

  it("refuses a list in a home the caller is not in", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirList = await seedList({ homeId: elsewhere.id, createdById: neighbour.id });
    const recipe = await recipeFor({ ingredients: "Flour" });

    await expectDenied(() =>
      addRecipeIngredients(formData({ recipeId: recipe.id, listId: theirList.id })),
    );
    expect(await prisma.listItem.count()).toBe(0);
  });

  it("refuses a recipe from a home the caller is not in", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirRecipe = await createRecipe({
      homeId: elsewhere.id,
      createdById: neighbour.id,
      ingredients: "Flour",
    });
    const list = await listFor();

    await expectDenied(() =>
      addRecipeIngredients(formData({ recipeId: theirRecipe.id, listId: list.id })),
    );
    expect(await prisma.listItem.count()).toBe(0);
  });
});

describe("what a recipe's note survives", () => {
  it("goes when the item is ticked off, and does not come back with it", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ title: "Pancakes", ingredients: "Milk" });
    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    const item = await prisma.listItem.findFirstOrThrow();
    await toggleListItem(formData({ itemId: item.id }));

    expect(await prisma.listItemSource.count()).toBe(0);

    await toggleListItem(formData({ itemId: item.id }));

    expect(await prisma.listItemSource.count()).toBe(0);
    expect((await prisma.listItem.findUniqueOrThrow({ where: { id: item.id } })).done).toBe(false);
  });

  it("goes with the item", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "Milk" });
    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    await deleteListItem(formData({ itemId: (await prisma.listItem.findFirstOrThrow()).id }));

    expect(await prisma.listItemSource.count()).toBe(0);
  });

  it("goes with the recipe, leaving the shopping where it is", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "Milk" });
    await addRecipeIngredients(formData({ recipeId: recipe.id, listId: list.id }));

    await expectRedirect(() => deleteRecipe(formData({ recipeId: recipe.id })), "/recipes");

    expect(await prisma.listItemSource.count()).toBe(0);
    expect(await prisma.listItem.count()).toBe(1);
  });
});
