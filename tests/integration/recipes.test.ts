import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRecipe, deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import {
  createHome,
  createHomeWithMembers,
  createRecipe as seedRecipe,
  createRecipeCategory,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let category: Awaited<ReturnType<typeof createRecipeCategory>>;

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  category = await createRecipeCategory({ homeId: home.id, name: "Baking" });
  await signIn(member);
});

const only = () => prisma.recipe.findFirstOrThrow();

/** The categories the one recipe is filed under, as ids. */
const filedUnder = async () =>
  (
    await prisma.recipeCategoryLink.findMany({
      where: { recipeId: (await only()).id },
      select: { categoryId: true },
    })
  ).map((link) => link.categoryId);

describe("createRecipe", () => {
  it("saves the recipe in the caller's home and opens it", async () => {
    const destination = await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pancakes",
          categoryIds: [category.id],
          description: "Sunday breakfast",
          ingredients: "Flour\nMilk\nEggs",
          instructions: "Mix.\nFry.",
        }),
      ),
    );

    const recipe = await only();
    expect(await filedUnder()).toEqual([category.id]);
    expect(recipe).toMatchObject({
      title: "Pancakes",
      description: "Sunday breakfast",
      ingredients: "Flour\nMilk\nEggs",
      instructions: "Mix.\nFry.",
      homeId: home.id,
      createdById: member.id,
    });
    expect(destination).toBe(`/recipes/${recipe.id}`);
  });

  it("keeps a valid video link", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "",
          instructions: "",
          videoUrl: "https://www.instagram.com/reel/AbC123/",
        }),
      ),
    );

    expect((await only()).videoUrl).toBe("https://www.instagram.com/reel/AbC123/");
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["nonsense", "not a url"],
  ])("refuses a %s video link instead of silently dropping it", async (_label, videoUrl) => {
    const result = await createRecipe(
      undefined,
      formData({ title: "Pasta", categoryIds: [category.id], ingredients: "", instructions: "", videoUrl }),
    );

    expect(result).toEqual({ ok: false, error: "That video link is not a valid web address." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("accepts a recipe with no video link at all", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({ title: "Pasta", categoryIds: [category.id], ingredients: "", instructions: "", videoUrl: "" }),
      ),
    );

    expect((await only()).videoUrl).toBeNull();
  });

  it("stores the total time when one is given", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "",
          instructions: "",
          totalTimeMinutes: "25",
        }),
      ),
    );

    expect((await only()).totalTimeMinutes).toBe(25);
  });

  it("stores a blank total time as null", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({ title: "Pasta", categoryIds: [category.id], ingredients: "", instructions: "" }),
      ),
    );

    expect((await only()).totalTimeMinutes).toBeNull();
  });

  it.each(["0", "-5", "not a number"])(
    "refuses a total time of %s instead of silently dropping it",
    async (totalTimeMinutes) => {
      const result = await createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "",
          instructions: "",
          totalTimeMinutes,
        }),
      );

      expect(result).toEqual({ ok: false, error: "Time must be a whole number of minutes." });
      expect(await prisma.recipe.count()).toBe(0);
    },
  );

  it("stores a blank description as null", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({ title: "Pasta", categoryIds: [category.id], description: "  ", ingredients: "", instructions: "" }),
      ),
    );

    expect((await only()).description).toBeNull();
  });

  it("files a recipe under every category that was chosen", async () => {
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });

    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Lasagne",
          categoryIds: [category.id, weeknight.id],
          ingredients: "",
          instructions: "",
        }),
      ),
    );

    expect((await filedUnder()).sort()).toEqual([category.id, weeknight.id].sort());
  });

  /*
   * A box cannot be ticked twice, so a repeated id means a submission that did not come
   * from the picker. Filing it once is the same answer as filing it once per tick, and
   * the pairings table would refuse the second row anyway.
   */
  it("files a recipe once under a category named twice", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pancakes",
          categoryIds: [category.id, category.id],
          ingredients: "",
          instructions: "",
        }),
      ),
    );

    expect(await filedUnder()).toEqual([category.id]);
  });

  it("refuses a recipe filed under one category it may see and one it may not", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Theirs" });

    const result = await createRecipe(
      undefined,
      formData({
        title: "Trojan",
        categoryIds: [category.id, theirs.id],
        ingredients: "",
        instructions: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("refuses a recipe with no category", async () => {
    const result = await createRecipe(
      undefined,
      formData({ title: "Pasta", ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  /*
   * The picker only ever offers this home's categories, so reaching here means either a
   * stale page or a hand-written submission. Either way the recipe must not end up filed
   * under a heading its household cannot see or rename.
   */
  it("refuses to file a recipe under another home's category", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Baking" });

    const result = await createRecipe(
      undefined,
      formData({ title: "Pasta", categoryIds: [theirs.id], ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("ignores a recipe with no title", async () => {
    await createRecipe(
      undefined,
      formData({ title: "  ", categoryIds: [category.id], ingredients: "x", instructions: "y" }),
    );

    expect(await prisma.recipe.count()).toBe(0);
  });
});

describe("updateRecipe", () => {
  it("replaces every field", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Better pancakes",
            description: "Improved",
            ingredients: "Flour\nButtermilk",
            instructions: "Rest the batter.",
            videoUrl: "https://youtu.be/dQw4w9WgXcQ",
            totalTimeMinutes: "40",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect(await only()).toMatchObject({
      title: "Better pancakes",
      description: "Improved",
      ingredients: "Flour\nButtermilk",
      instructions: "Rest the batter.",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      totalTimeMinutes: 40,
    });
  });

  it("clears a total time that is removed", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id],
      totalTimeMinutes: 45,
    });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Pancakes",
            ingredients: "",
            instructions: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect((await only()).totalTimeMinutes).toBeNull();
  });

  it("clears a video link that is removed", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id],
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Pancakes",
            ingredients: "",
            instructions: "",
            videoUrl: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect((await only()).videoUrl).toBeNull();
  });

  it("refuses to blank out the title", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await updateRecipe(
      undefined,
      formData({ recipeId: recipe.id, categoryIds: [category.id], title: "   ", ingredients: "", instructions: "" }),
    );

    expect((await only()).title).toBe("Pancakes");
  });

  it("moves a recipe to a different category", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [weeknight.id],
            title: "Pancakes",
            ingredients: "",
            instructions: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect(await filedUnder()).toEqual([weeknight.id]);
  });

  it("replaces the whole set of categories, keeping the ones ticked again", async () => {
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });
    const italian = await createRecipeCategory({ homeId: home.id, name: "Italian" });
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id, weeknight.id],
    });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            // Baking goes, Weeknight stays, Italian is added.
            categoryIds: [weeknight.id, italian.id],
            title: "Lasagne",
            ingredients: "",
            instructions: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect((await filedUnder()).sort()).toEqual([italian.id, weeknight.id].sort());
  });

  it("refuses to leave a recipe filed under nothing", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id],
    });

    const result = await updateRecipe(
      undefined,
      formData({ recipeId: recipe.id, title: "Pancakes", ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await filedUnder()).toEqual([category.id]);
  });

  it("refuses to move a recipe into another home's category", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Baking" });

    const result = await updateRecipe(
      undefined,
      formData({
        recipeId: recipe.id,
        categoryIds: [theirs.id],
        title: "Pancakes",
        ingredients: "",
        instructions: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await filedUnder()).toEqual([category.id]);
  });

  it("fails loudly for a recipe that does not exist", async () => {
    await expect(
      updateRecipe(
        undefined,
        formData({ recipeId: "missing", categoryIds: [category.id], title: "x", ingredients: "", instructions: "" }),
      ),
    ).rejects.toThrow("Recipe not found");
  });
});

describe("deleteRecipe", () => {
  it("removes the recipe and returns to the index", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await expectRedirect(() => deleteRecipe(formData({ recipeId: recipe.id })), "/recipes");

    expect(await prisma.recipe.count()).toBe(0);
  });
});
