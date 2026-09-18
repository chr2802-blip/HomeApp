import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { refreshSuggestedRecipe, suggestedRecipeFor } from "@/lib/recipe-suggestion";
import { findNewSuggestedRecipe } from "@/app/actions/recipe-suggestion";
import {
  createHome,
  createHomeWithMembers,
  createRecipe,
  createRecipeCategory,
  signIn,
} from "../helpers/factories";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
});

const stored = () => prisma.recipeSuggestion.findUniqueOrThrow({ where: { homeId: home.id } });

describe("suggestedRecipeFor", () => {
  it("returns null for a home with no recipes", async () => {
    expect(await suggestedRecipeFor(home.id)).toBeNull();
    expect(await prisma.recipeSuggestion.count()).toBe(0);
  });

  it("picks the home's only recipe and remembers the pick", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });

    expect((await suggestedRecipeFor(home.id))?.id).toBe(recipe.id);
    expect((await stored()).recipeId).toBe(recipe.id);
  });

  it("keeps the same pick on a second call the same day", async () => {
    await createRecipe({ homeId: home.id, createdById: member.id, title: "A" });
    await createRecipe({ homeId: home.id, createdById: member.id, title: "B" });

    const first = await suggestedRecipeFor(home.id);
    const second = await suggestedRecipeFor(home.id);
    expect(second?.id).toBe(first?.id);
  });

  it("picks again once the stored date is no longer today", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await suggestedRecipeFor(home.id);
    await prisma.recipeSuggestion.update({
      where: { homeId: home.id },
      data: { date: "2000-01-01" },
    });

    expect((await suggestedRecipeFor(home.id))?.id).toBe(recipe.id);
    expect((await stored()).date).not.toBe("2000-01-01");
  });

  it("excludes a recipe filed under an excluded category", async () => {
    const babyFood = await createRecipeCategory({ homeId: home.id, excludeFromSuggestion: true });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [babyFood.id] });
    const weeknight = await createRecipeCategory({ homeId: home.id });
    const allowed = await createRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [weeknight.id],
    });

    expect((await suggestedRecipeFor(home.id))?.id).toBe(allowed.id);
  });

  it("excludes a recipe with several headings if any one of them is excluded", async () => {
    const babyFood = await createRecipeCategory({ homeId: home.id, excludeFromSuggestion: true });
    const weeknight = await createRecipeCategory({ homeId: home.id });
    await createRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [babyFood.id, weeknight.id],
    });

    expect(await suggestedRecipeFor(home.id)).toBeNull();
  });

  it("returns null once every recipe is excluded", async () => {
    const babyFood = await createRecipeCategory({ homeId: home.id, excludeFromSuggestion: true });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [babyFood.id] });

    expect(await suggestedRecipeFor(home.id)).toBeNull();
    expect(await prisma.recipeSuggestion.count()).toBe(0);
  });

  it("never suggests another home's recipe", async () => {
    const neighbour = await createHome({ name: "Next door" });
    await createRecipe({ homeId: neighbour.id, createdById: member.id });

    expect(await suggestedRecipeFor(home.id)).toBeNull();
  });
});

describe("refreshSuggestedRecipe", () => {
  it("replaces the stored pick with the other eligible recipe", async () => {
    const a = await createRecipe({ homeId: home.id, createdById: member.id, title: "A" });
    const b = await createRecipe({ homeId: home.id, createdById: member.id, title: "B" });
    await suggestedRecipeFor(home.id);
    const before = (await stored()).recipeId;

    const after = await refreshSuggestedRecipe(home.id);

    expect(after).not.toBe(before);
    expect([a.id, b.id]).toContain(after);
    expect((await stored()).recipeId).toBe(after);
  });

  it("has nothing else to offer when only one recipe is eligible", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await suggestedRecipeFor(home.id);

    expect(await refreshSuggestedRecipe(home.id)).toBe(recipe.id);
  });

  it("returns null when there is nothing eligible to switch to", async () => {
    expect(await refreshSuggestedRecipe(home.id)).toBeNull();
  });
});

describe("findNewSuggestedRecipe", () => {
  it("re-picks for the caller's own home", async () => {
    await createRecipe({ homeId: home.id, createdById: member.id, title: "A" });
    await createRecipe({ homeId: home.id, createdById: member.id, title: "B" });
    await signIn(member);
    await suggestedRecipeFor(home.id);
    const before = (await stored()).recipeId;

    await findNewSuggestedRecipe();

    expect((await stored()).recipeId).not.toBe(before);
  });
});

/*
 * RecipeSuggestion cascades from the recipe it points at, so a deleted recipe cannot be
 * left as a stale pick — the next visit simply picks again, the same as any other day
 * nothing was stored yet.
 */
describe("deleting the suggested recipe", () => {
  it("clears the stored pick along with it", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await suggestedRecipeFor(home.id);

    await prisma.recipe.delete({ where: { id: recipe.id } });

    expect(await prisma.recipeSuggestion.count()).toBe(0);
  });
});
