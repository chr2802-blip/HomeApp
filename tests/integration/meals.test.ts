import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { planMeal } from "@/app/actions/meals";
import { PLAN_FIELD, PLAN_OUT } from "@/lib/meals";
import {
  createHome,
  createHomeWithMembers,
  createRecipe,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const only = () => prisma.mealPlan.findFirstOrThrow();
const plan = (date: string, choice: string) => formData({ date, [PLAN_FIELD]: choice });

describe("planMeal", () => {
  it("plans a recipe for a day in the caller's home", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });

    const result = await planMeal(undefined, plan("2026-06-04", recipe.id));

    expect(result).toEqual({ ok: true });
    expect(await only()).toMatchObject({
      homeId: home.id,
      date: "2026-06-04",
      recipeId: recipe.id,
    });
  });

  it("stores a night out as a row with no recipe", async () => {
    await planMeal(undefined, plan("2026-06-04", PLAN_OUT));

    // The row is the decision; null inside it is the night out. A day nobody planned has
    // no row at all, which is what makes the two tell each other apart.
    expect(await only()).toMatchObject({ date: "2026-06-04", recipeId: null });
  });

  it("replaces the day's plan rather than adding a second answer to it", async () => {
    const first = await createRecipe({ homeId: home.id, createdById: member.id });
    const second = await createRecipe({
      homeId: home.id,
      createdById: member.id,
      title: "Lasagne",
    });

    await planMeal(undefined, plan("2026-06-04", first.id));
    await planMeal(undefined, plan("2026-06-04", second.id));
    await planMeal(undefined, plan("2026-06-04", PLAN_OUT));

    expect(await prisma.mealPlan.count()).toBe(1);
    expect((await only()).recipeId).toBeNull();
  });

  it("takes the row away when the day goes back to nothing planned", async () => {
    await planMeal(undefined, plan("2026-06-04", PLAN_OUT));

    const result = await planMeal(undefined, plan("2026-06-04", ""));

    expect(result).toEqual({ ok: true });
    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("clears a day nobody had planned without complaining", async () => {
    expect(await planMeal(undefined, plan("2026-06-04", ""))).toEqual({ ok: true });
  });

  it("leaves the other days of the week alone", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });

    await planMeal(undefined, plan("2026-06-04", recipe.id));
    await planMeal(undefined, plan("2026-06-05", PLAN_OUT));
    await planMeal(undefined, plan("2026-06-04", ""));

    const rows = await prisma.mealPlan.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-06-05", recipeId: null });
  });

  it("never reaches another home's day, even for the same date", async () => {
    // The clear below carries a date and nothing else; the home comes from the session.
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirRecipe = await createRecipe({ homeId: elsewhere.id, createdById: neighbour.id });

    await signIn(neighbour);
    await planMeal(undefined, plan("2026-06-04", theirRecipe.id));

    await signIn(member);
    await planMeal(undefined, plan("2026-06-04", ""));

    expect(await prisma.mealPlan.count()).toBe(1);
    expect((await only()).homeId).toBe(elsewhere.id);
  });

  it("refuses a recipe from another home", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirs = await createRecipe({ homeId: elsewhere.id, createdById: neighbour.id });

    const result = await planMeal(undefined, plan("2026-06-04", theirs.id));

    expect(result).toEqual({ ok: false, error: "That recipe is not in this home." });
    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("refuses a recipe id that is not a recipe at all", async () => {
    const result = await planMeal(undefined, plan("2026-06-04", "not-a-recipe"));

    expect(result).toEqual({ ok: false, error: "That recipe is not in this home." });
  });

  it("refuses a date that is not a real day", async () => {
    for (const date of ["", "tomorrow", "2026-02-31", "2026-13-01"]) {
      expect(await planMeal(undefined, plan(date, PLAN_OUT))).toEqual({
        ok: false,
        error: "That is not a real date.",
      });
    }

    expect(await prisma.mealPlan.count()).toBe(0);
  });
});

describe("a planned recipe that is deleted", () => {
  it("takes the day's plan with it, rather than leaving a night out nobody planned", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await planMeal(undefined, plan("2026-06-04", recipe.id));

    await prisma.recipe.delete({ where: { id: recipe.id } });

    // Null means "eating out", so SetNull here would have invented a plan. The day goes
    // back to nothing planned, which is where it was before the recipe was chosen.
    expect(await prisma.mealPlan.count()).toBe(0);
  });
});

describe("deleting a home", () => {
  it("takes its meal plans with it", async () => {
    await planMeal(undefined, plan("2026-06-04", PLAN_OUT));

    await prisma.home.delete({ where: { id: home.id } });

    expect(await prisma.mealPlan.count()).toBe(0);
  });
});
