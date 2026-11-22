import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { refreshTonightsDinner, tonightsDinner } from "@/lib/recipe-suggestion";
import { findNewSuggestedRecipe } from "@/app/actions/recipe-suggestion";
import { planMeal } from "@/app/actions/meals";
import { PLAN_FIELD, PLAN_OUT, leftoversChoice } from "@/lib/meals";
import { todayInZone } from "@/lib/time";
import {
  createHome,
  createHomeWithMembers,
  createRecipe,
  createRecipeCategory,
  formData,
  signIn,
} from "../helpers/factories";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

const today = () => todayInZone();

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
});

/** Today planned by hand, as `/meals` would — nothing is auto-picked any more. */
const planToday = (recipeId: string) =>
  prisma.mealPlan.create({ data: { homeId: home.id, date: today(), recipeId } });

const stored = () =>
  prisma.mealPlan.findUniqueOrThrow({ where: { homeId_date: { homeId: home.id, date: today() } } });

describe("tonightsDinner", () => {
  it("returns null for a home with no recipes", async () => {
    expect(await tonightsDinner(home.id, "EN")).toBeNull();
    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("picks nothing on a day nobody has planned, and writes nothing", async () => {
    await createRecipe({ homeId: home.id, createdById: member.id });

    expect(await tonightsDinner(home.id, "EN")).toBeNull();
    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("shows a recipe already planned by hand, without picking a new one", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await signIn(member);
    await planMeal(undefined, formData({ date: today(), [PLAN_FIELD]: recipe.id }));

    expect((await tonightsDinner(home.id, "EN"))?.recipeId).toBe(recipe.id);
  });

  it("says nothing for a night out already decided, rather than a suggestion", async () => {
    await createRecipe({ homeId: home.id, createdById: member.id });
    await signIn(member);
    await planMeal(undefined, formData({ date: today(), [PLAN_FIELD]: PLAN_OUT }));

    expect(await tonightsDinner(home.id, "EN")).toBeNull();
    // The decision is left alone — this never overwrites the night out with a pick.
    expect((await stored()).recipeId).toBeNull();
  });

  it("shows leftovers as what they are the leftovers of, not suggestable", async () => {
    const lasagne = await createRecipe({ homeId: home.id, createdById: member.id, title: "Lasagne" });
    await signIn(member);
    const yesterday = todayInZone(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await planMeal(undefined, formData({ date: yesterday, [PLAN_FIELD]: lasagne.id }));
    await planMeal(undefined, formData({ date: today(), [PLAN_FIELD]: leftoversChoice(yesterday) }));

    const dinner = await tonightsDinner(home.id, "EN");
    expect(dinner).toMatchObject({ recipeId: lasagne.id, suggestable: false });
    expect(dinner?.title).toContain("Lasagne");
  });
});

describe("refreshTonightsDinner", () => {
  it("replaces today's plan with the other eligible recipe", async () => {
    const a = await createRecipe({ homeId: home.id, createdById: member.id, title: "A" });
    const b = await createRecipe({ homeId: home.id, createdById: member.id, title: "B" });
    await planToday(a.id);
    const before = (await stored()).recipeId;

    const after = await refreshTonightsDinner(home.id);

    expect(after).not.toBe(before);
    expect([a.id, b.id]).toContain(after);
    expect((await stored()).recipeId).toBe(after);
  });

  it("has nothing else to offer when only one recipe is eligible", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await planToday(recipe.id);

    expect(await refreshTonightsDinner(home.id)).toBe(recipe.id);
  });

  it("never switches to a recipe filed under an excluded category", async () => {
    const babyFood = await createRecipeCategory({ homeId: home.id, excludeFromSuggestion: true });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [babyFood.id] });
    const weeknight = await createRecipeCategory({ homeId: home.id });
    const allowed = await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [weeknight.id] });
    await planToday(allowed.id);

    expect(await refreshTonightsDinner(home.id)).toBe(allowed.id);
  });

  it("still offers a recipe that is also filed under an ordinary category", async () => {
    const babyFood = await createRecipeCategory({ homeId: home.id, excludeFromSuggestion: true });
    const weeknight = await createRecipeCategory({ homeId: home.id });
    const both = await createRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [babyFood.id, weeknight.id],
    });
    const onlyBaby = await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [babyFood.id] });
    await planToday(onlyBaby.id);

    expect(await refreshTonightsDinner(home.id)).toBe(both.id);
  });

  it("never switches to another home's recipe", async () => {
    const mine = await createRecipe({ homeId: home.id, createdById: member.id });
    const neighbour = await createHome({ name: "Next door" });
    await createRecipe({ homeId: neighbour.id, createdById: member.id });
    await planToday(mine.id);

    expect(await refreshTonightsDinner(home.id)).toBe(mine.id);
  });

  it("returns null when there is nothing eligible to switch to", async () => {
    expect(await refreshTonightsDinner(home.id)).toBeNull();
  });
});

describe("findNewSuggestedRecipe", () => {
  it("re-picks for the caller's own home", async () => {
    const a = await createRecipe({ homeId: home.id, createdById: member.id, title: "A" });
    await createRecipe({ homeId: home.id, createdById: member.id, title: "B" });
    await signIn(member);
    await planToday(a.id);
    const before = (await stored()).recipeId;

    await findNewSuggestedRecipe();

    expect((await stored()).recipeId).not.toBe(before);
  });
});

/*
 * A planned recipe cascades from the recipe it points at, so a deleted recipe cannot be
 * left as a stale pick — today simply goes back to nothing planned.
 */
describe("deleting the planned recipe", () => {
  it("clears today's plan along with it", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await planToday(recipe.id);

    await prisma.recipe.delete({ where: { id: recipe.id } });

    expect(await prisma.mealPlan.count()).toBe(0);
  });
});
