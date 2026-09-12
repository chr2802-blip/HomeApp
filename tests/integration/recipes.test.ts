import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRecipe, deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import {
  createHomeWithMembers,
  createRecipe as seedRecipe,
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

const only = () => prisma.recipe.findFirstOrThrow();

describe("createRecipe", () => {
  it("saves the recipe in the caller's home and opens it", async () => {
    const destination = await captureRedirect(() =>
      createRecipe(
        formData({
          title: "Pancakes",
          description: "Sunday breakfast",
          ingredients: "Flour\nMilk\nEggs",
          instructions: "Mix.\nFry.",
        }),
      ),
    );

    const recipe = await only();
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
        formData({
          title: "Pasta",
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
  ])("strips a %s video link", async (_label, videoUrl) => {
    await captureRedirect(() =>
      createRecipe(formData({ title: "Pasta", ingredients: "", instructions: "", videoUrl })),
    );

    expect((await only()).videoUrl).toBeNull();
  });

  it("stores a blank description as null", async () => {
    await captureRedirect(() =>
      createRecipe(formData({ title: "Pasta", description: "  ", ingredients: "", instructions: "" })),
    );

    expect((await only()).description).toBeNull();
  });

  it("ignores a recipe with no title", async () => {
    await createRecipe(formData({ title: "  ", ingredients: "x", instructions: "y" }));

    expect(await prisma.recipe.count()).toBe(0);
  });
});

describe("updateRecipe", () => {
  it("replaces every field", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id });

    await expectRedirect(
      () =>
        updateRecipe(
          formData({
            recipeId: recipe.id,
            title: "Better pancakes",
            description: "Improved",
            ingredients: "Flour\nButtermilk",
            instructions: "Rest the batter.",
            videoUrl: "https://youtu.be/dQw4w9WgXcQ",
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
    });
  });

  it("clears a video link that is removed", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    });

    await expectRedirect(
      () =>
        updateRecipe(
          formData({
            recipeId: recipe.id,
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
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id });

    await updateRecipe(
      formData({ recipeId: recipe.id, title: "   ", ingredients: "", instructions: "" }),
    );

    expect((await only()).title).toBe("Pancakes");
  });

  it("fails loudly for a recipe that does not exist", async () => {
    await expect(
      updateRecipe(formData({ recipeId: "missing", title: "x", ingredients: "", instructions: "" })),
    ).rejects.toThrow("Recipe not found");
  });
});

describe("deleteRecipe", () => {
  it("removes the recipe and returns to the index", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id });

    await expectRedirect(() => deleteRecipe(formData({ recipeId: recipe.id })), "/recipes");

    expect(await prisma.recipe.count()).toBe(0);
  });
});
