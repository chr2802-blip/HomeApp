import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addRecipeToNextOpenDay, planMeal, resetMealWeek } from "@/app/actions/meals";
import { PLAN_FIELD, PLAN_OUT, leftoversChoice } from "@/lib/meals";
import { dueAtDaysFrom, todayInZone, weekDays } from "@/lib/time";
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

describe("planning leftovers", () => {
  /** Thursday cooked, so Friday has something to be the leftovers of. */
  async function cookOnThursday() {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await planMeal(undefined, plan("2026-06-04", recipe.id));
    return recipe;
  }

  it("points the day at the one whose cooking it is living off", async () => {
    await cookOnThursday();

    const result = await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")));

    expect(result).toEqual({ ok: true });
    expect(await prisma.mealPlan.findFirstOrThrow({ where: { date: "2026-06-05" } })).toMatchObject({
      recipeId: null,
      leftoverOf: "2026-06-04",
    });
  });

  it("refuses a day that has not been cooked yet", async () => {
    // Nothing on Thursday at all: leftovers of an empty evening is not a sentence.
    const result = await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")));

    expect(result).toEqual({
      ok: false,
      error: "There is nothing cooked that day to have leftovers of.",
    });
    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("refuses the leftovers of a night out", async () => {
    await planMeal(undefined, plan("2026-06-04", PLAN_OUT));

    expect(await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")))).toEqual({
      ok: false,
      error: "There is nothing cooked that day to have leftovers of.",
    });
  });

  it("refuses the leftovers of a day that has not happened", async () => {
    // Checked against the stored row rather than what the form believed, and refused on
    // the order of the days alone — which is also what makes a cycle unwritable.
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await planMeal(undefined, plan("2026-06-06", recipe.id));

    expect(await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-06")))).toEqual({
      ok: false,
      error: "Leftovers come after the meal, not before it.",
    });
  });

  it("refuses to make a day the leftovers of itself", async () => {
    await cookOnThursday();

    expect(await planMeal(undefined, plan("2026-06-04", leftoversChoice("2026-06-04")))).toEqual({
      ok: false,
      error: "Leftovers come after the meal, not before it.",
    });
  });

  it("refuses a source day that is not a real date", async () => {
    expect(await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-02-31")))).toEqual({
      ok: false,
      error: "That is not a real date.",
    });
  });

  it("never reaches another home's cooking for its source", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirRecipe = await createRecipe({ homeId: elsewhere.id, createdById: neighbour.id });

    await signIn(neighbour);
    await planMeal(undefined, plan("2026-06-04", theirRecipe.id));

    // The source is looked up through homeDb, so their Thursday is simply not there.
    await signIn(member);
    expect(await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")))).toEqual({
      ok: false,
      error: "There is nothing cooked that day to have leftovers of.",
    });
  });

  it("puts the pointer down when the day becomes a meal of its own", async () => {
    // Both columns are written on every save: a row still carrying the pointer would be
    // claiming a recipe and an earlier day at once, which is the one shape that has no
    // meaning.
    const recipe = await cookOnThursday();
    await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")));

    await planMeal(undefined, plan("2026-06-05", recipe.id));

    expect(await prisma.mealPlan.findFirstOrThrow({ where: { date: "2026-06-05" } })).toMatchObject({
      recipeId: recipe.id,
      leftoverOf: null,
    });
  });

  it("leaves the leftovers standing when the day they came from is cleared", async () => {
    // The pointer is a plain day and not a relation, so nothing cascades: Friday is
    // still leftovers of something, which is the half of it that is still true. The page
    // resolves what it can and says the bare word for what it cannot.
    await cookOnThursday();
    await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")));

    await planMeal(undefined, plan("2026-06-04", ""));

    expect(await prisma.mealPlan.findFirstOrThrow({ where: { date: "2026-06-05" } })).toMatchObject({
      leftoverOf: "2026-06-04",
    });
  });

  it("follows the day it points at when that day changes its mind", async () => {
    // "Friday is Thursday's leftovers" stays true whatever Thursday turns out to be, so
    // the pointer is to the day and not to the recipe it happened to hold.
    await cookOnThursday();
    await planMeal(undefined, plan("2026-06-05", leftoversChoice("2026-06-04")));

    const second = await createRecipe({
      homeId: home.id,
      createdById: member.id,
      title: "Lasagne",
    });
    await planMeal(undefined, plan("2026-06-04", second.id));

    expect(await prisma.mealPlan.findFirstOrThrow({ where: { date: "2026-06-05" } })).toMatchObject({
      leftoverOf: "2026-06-04",
    });
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

describe("resetMealWeek", () => {
  const week = "2026-06-01"; // A Monday.

  it("clears every day of the week and only that week", async () => {
    const days = weekDays(week);
    await planMeal(undefined, plan(days[0]!, PLAN_OUT));
    await planMeal(undefined, plan(days[6]!, PLAN_OUT));
    // The Monday after: outside the week being reset, so it must survive.
    const nextWeekDay = weekDays("2026-06-08")[0]!;
    await planMeal(undefined, plan(nextWeekDay, PLAN_OUT));

    await resetMealWeek(formData({ week }));

    const remaining = await prisma.mealPlan.findMany({ select: { date: true } });
    expect(remaining.map((row) => row.date)).toEqual([nextWeekDay]);
  });

  it("clears a week with nothing planned without complaining", async () => {
    await expect(resetMealWeek(formData({ week }))).resolves.toBeUndefined();
    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("does nothing when the week is not a real date", async () => {
    await planMeal(undefined, plan(week, PLAN_OUT));

    await resetMealWeek(formData({ week: "not-a-week" }));

    expect(await prisma.mealPlan.count()).toBe(1);
  });

  it("never reaches another home's week", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });

    await signIn(neighbour);
    await planMeal(undefined, plan(week, PLAN_OUT));

    await signIn(member);
    await resetMealWeek(formData({ week }));

    expect(await prisma.mealPlan.count()).toBe(1);
    expect((await only()).homeId).toBe(elsewhere.id);
  });
});

describe("addRecipeToNextOpenDay", () => {
  const addTo = (recipeId: string) => formData({ recipeId });

  it("books the recipe on today when today has nothing planned", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });

    await addRecipeToNextOpenDay(addTo(recipe.id));

    expect(await only()).toMatchObject({
      homeId: home.id,
      date: todayInZone(),
      recipeId: recipe.id,
    });
  });

  it("skips days that already have something planned", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    const today = todayInZone();
    const tomorrow = todayInZone(dueAtDaysFrom(1));
    const dayAfter = todayInZone(dueAtDaysFrom(2));

    // Today is cooking something, tomorrow is a night out — both count as planned.
    await planMeal(undefined, plan(today, PLAN_OUT));
    await planMeal(undefined, plan(tomorrow, PLAN_OUT));

    await addRecipeToNextOpenDay(addTo(recipe.id));

    const added = await prisma.mealPlan.findFirstOrThrow({ where: { recipeId: recipe.id } });
    expect(added.date).toBe(dayAfter);
    // Neither of the two days already planned was touched.
    expect(await prisma.mealPlan.count()).toBe(3);
  });

  it("refuses a recipe that is not in this home", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirs = await createRecipe({ homeId: elsewhere.id, createdById: neighbour.id });

    await addRecipeToNextOpenDay(addTo(theirs.id));

    expect(await prisma.mealPlan.count()).toBe(0);
  });

  it("never reaches another home's plans when looking for a free day", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirRecipe = await createRecipe({ homeId: elsewhere.id, createdById: neighbour.id });

    await signIn(neighbour);
    await planMeal(undefined, plan(todayInZone(), theirRecipe.id));

    // Their today is taken; this home's today is still free.
    await signIn(member);
    const recipe = await createRecipe({ homeId: home.id, createdById: member.id });
    await addRecipeToNextOpenDay(addTo(recipe.id));

    expect(
      await prisma.mealPlan.findFirstOrThrow({ where: { homeId: home.id } }),
    ).toMatchObject({ date: todayInZone(), recipeId: recipe.id });
    expect(await prisma.mealPlan.findFirstOrThrow({ where: { homeId: elsewhere.id } })).toMatchObject(
      { date: todayInZone(), recipeId: theirRecipe.id },
    );
  });
});
