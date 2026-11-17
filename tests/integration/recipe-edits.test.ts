import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addRecipesToCategories, createRecipe, editCookStep, updateRecipe } from "@/app/actions/recipes";
import { RECIPES } from "@/lib/copy/recipes";
import { IN_FORMAT } from "@/lib/cook";
import { STAY_FIELD } from "@/lib/recipes";
import {
  createHome,
  createHomeWithMembers,
  createRecipe as seedRecipe,
  createRecipeCategory,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let category: Awaited<ReturnType<typeof createRecipeCategory>>;

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  category = await createRecipeCategory({ homeId: home.id, name: "Baking" });
  await signIn(member);
});

const seed = (data: Partial<Parameters<typeof seedRecipe>[0]> = {}) =>
  seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id], ...data });

/** A plain edit with neither block touched by the reader: no ingredients, no steps. */
const edit = (recipeId: string, fields: Record<string, string | string[]> = {}) =>
  formData({ recipeId, title: "Pancakes", categoryIds: [category.id], ingredients: "", instructions: "", ...fields });

describe("a recipe's title, once per home", () => {
  it("refuses a new recipe named like one the home already has, whatever its case", async () => {
    await seed({ title: "Lasagne" });

    const result = await createRecipe(
      undefined,
      formData({ title: "  lasagne ", categoryIds: [category.id], ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: RECIPES.duplicateTitle.EN.replace("{title}", "Lasagne") });
    expect(await prisma.recipe.count()).toBe(1);
  });

  it("does not count another home's recipe", async () => {
    const neighbour = await createHome({ name: "Next door" });
    await seedRecipe({ homeId: neighbour.id, createdById: member.id, title: "Lasagne" });

    await captureRedirect(() =>
      createRecipe(undefined, formData({ title: "Lasagne", categoryIds: [category.id], ingredients: "", instructions: "" })),
    );
    expect(await prisma.recipe.count({ where: { homeId: home.id } })).toBe(1);
  });

  it("refuses renaming one onto another's name, and lets one keep its own", async () => {
    await seed({ title: "Lasagne" });
    const pancakes = await seed({ title: "Pancakes" });

    expect(await updateRecipe(undefined, edit(pancakes.id, { title: "LASAGNE" }))).toMatchObject({ ok: false });
    expect(await captureRedirect(() => updateRecipe(undefined, edit(pancakes.id)))).toBe(`/recipes/${pancakes.id}`);
  });
});

describe("an edit made from the recipe list", () => {
  it("answers in place rather than opening the recipe", async () => {
    const recipe = await seed({ title: "Pancakes" });

    const result = await updateRecipe(undefined, edit(recipe.id, { title: "Crêpes", [STAY_FIELD]: "1" }));

    expect(result).toEqual({ ok: true });
    expect((await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } })).title).toBe("Crêpes");
  });
});

describe("addRecipesToCategories", () => {
  it("adds the headings to every chosen recipe and keeps the ones they had", async () => {
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });
    const a = await seed({ title: "A" });
    const b = await seed({ title: "B", categoryIds: [weeknight.id] });

    const result = await addRecipesToCategories(
      undefined,
      formData({ recipeIds: [a.id, b.id], categoryIds: [weeknight.id] }),
    );

    expect(result).toMatchObject({ ok: true });
    const filed = async (id: string) =>
      (await prisma.recipeCategoryLink.findMany({ where: { recipeId: id } })).map((link) => link.categoryId).sort();
    expect(await filed(a.id)).toEqual([category.id, weeknight.id].sort());
    expect(await filed(b.id)).toEqual([weeknight.id]);
  });

  it("refuses the whole press when a recipe is another home's", async () => {
    const neighbour = await createHome({ name: "Next door" });
    const theirs = await seedRecipe({ homeId: neighbour.id, createdById: member.id, title: "Theirs" });
    const mine = await seed({ title: "Mine" });
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });

    const result = await addRecipesToCategories(
      undefined,
      formData({ recipeIds: [mine.id, theirs.id], categoryIds: [weeknight.id] }),
    );

    expect(result).toEqual({ ok: false, error: RECIPES.bulkRecipesGone.EN });
    expect(await prisma.recipeCategoryLink.count({ where: { categoryId: weeknight.id } })).toBe(0);
  });

  it("refuses another home's heading, and a press with no heading", async () => {
    const mine = await seed();
    const neighbour = await createHome({ name: "Next door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Theirs" });

    expect(
      await addRecipesToCategories(undefined, formData({ recipeIds: [mine.id], categoryIds: [theirs.id] })),
    ).toMatchObject({ ok: false });
    expect(await addRecipesToCategories(undefined, formData({ recipeIds: [mine.id] }))).toMatchObject({ ok: false });
  });
});

describe("editCookStep", () => {
  it("rewrites one step and its breakdown entry, leaving the rest", async () => {
    const recipe = await seed({
      ingredients: "400 g pasta\n2 dl fløde",
      instructions: "Kog pastaen.\nPisk fløden.",
      cookSteps: { v: IN_FORMAT, steps: [{ uses: [0], minutes: 10 }, { uses: [1], minutes: null }] },
    });

    const result = await editCookStep(
      undefined,
      formData({ recipeId: recipe.id, step: "1", stepText: "Pisk fløden let.", uses: ["0", "1"], minutes: "2" }),
    );

    expect(result).toEqual({ ok: true });
    const stored = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(stored.instructions).toBe("Kog pastaen.\nPisk fløden let.");
    expect(stored.ingredients).toBe("400 g pasta\n2 dl fløde");
    expect(stored.cookSteps).toEqual({
      v: IN_FORMAT,
      steps: [{ uses: [0], minutes: 10 }, { uses: [0, 1], minutes: 2 }],
    });
  });

  it("refuses an empty step, a timer that is not whole minutes, and a step not there", async () => {
    const recipe = await seed({ instructions: "Kog." });

    expect(await editCookStep(undefined, formData({ recipeId: recipe.id, step: "0", stepText: " " }))).toEqual({
      ok: false,
      error: RECIPES.stepTextRequired.EN,
    });
    expect(
      await editCookStep(undefined, formData({ recipeId: recipe.id, step: "0", stepText: "Kog.", minutes: "1.5" })),
    ).toMatchObject({ ok: false });
    expect(await editCookStep(undefined, formData({ recipeId: recipe.id, step: "4", stepText: "Kog." }))).toEqual({
      ok: false,
      error: RECIPES.stepGone.EN,
    });
  });

  it("will not touch another home's recipe", async () => {
    const neighbour = await createHome({ name: "Next door" });
    const theirs = await seedRecipe({ homeId: neighbour.id, createdById: member.id, instructions: "Kog." });

    await expect(
      editCookStep(undefined, formData({ recipeId: theirs.id, step: "0", stepText: "Brænd." })),
    ).rejects.toThrow();
    expect((await prisma.recipe.findUniqueOrThrow({ where: { id: theirs.id } })).instructions).toBe("Kog.");
  });
});
