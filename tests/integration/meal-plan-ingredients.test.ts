import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addMealPlanIngredients } from "@/app/actions/lists";
import { planMeal } from "@/app/actions/meals";
import { PLAN_FIELD, PLAN_OUT, leftoversChoice } from "@/lib/meals";
import { todayInZone, weekDays, weekStartOn } from "@/lib/time";
import {
  createHome,
  createHomeWithMembers,
  createList as seedList,
  createRecipe,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { expectDenied } from "../helpers/expect";

/**
 * "Add to list" for a whole week's meal plan, the same write `addRecipeIngredients`
 * makes for one recipe — see that suite for the ingredient-matching rules this shares.
 * What is worth pinning down here is which days count: a recipe cooking, and nothing
 * else.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

// A fixed Thursday, so the week it falls in (Monday 2026-06-01) is stable across runs.
const THURSDAY = "2026-06-04";
const WEEK = weekStartOn(THURSDAY)!;

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const listFor = (title = "Shopping") =>
  seedList({ homeId: home.id, createdById: member.id, title });

const recipeFor = (options: { title?: string; ingredients?: string }) =>
  createRecipe({ homeId: home.id, createdById: member.id, ...options });

const plan = (date: string, choice: string) =>
  planMeal(undefined, formData({ date, [PLAN_FIELD]: choice }));

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

describe("addMealPlanIngredients", () => {
  it("puts every day's ingredients on the list", async () => {
    const list = await listFor();
    const monday = await recipeFor({ title: "Pancakes", ingredients: "Flour\nMilk" });
    const tuesday = await recipeFor({ title: "Risotto", ingredients: "Rice\nMilk" });
    await plan("2026-06-01", monday.id);
    await plan("2026-06-02", tuesday.id);

    const result = await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect(result).toEqual({ ok: true });
    const items = await itemsOnList();
    expect(items.map((item) => item.text).sort()).toEqual(["Flour", "Milk", "Rice"]);
    expect(await recipesBehind("Milk")).toEqual(["Pancakes", "Risotto"]);
  });

  it("skips a night out and a day nothing is planned", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "Flour" });
    await plan("2026-06-01", recipe.id);
    await plan("2026-06-02", PLAN_OUT);
    // 2026-06-03 is left with nothing planned at all.

    await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect((await itemsOnList()).map((item) => item.text)).toEqual(["Flour"]);
  });

  it("skips leftovers, which name no recipe of their own", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ title: "Curry", ingredients: "Rice\nCurry paste" });
    await plan("2026-06-01", recipe.id);
    await plan("2026-06-02", leftoversChoice("2026-06-01"));

    await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    // Curry's own ingredients once, not twice over for the day living off them.
    const items = await itemsOnList();
    expect(items.map((item) => item.amount)).toEqual([1, 1]);
  });

  it("ignores what is planned outside the week asked for", async () => {
    const list = await listFor();
    const inWeek = await recipeFor({ title: "In week", ingredients: "Flour" });
    const before = await recipeFor({ title: "Before", ingredients: "Sugar" });
    await plan("2026-06-01", inWeek.id);
    await plan("2026-05-25", before.id);

    await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect((await itemsOnList()).map((item) => item.text)).toEqual(["Flour"]);
  });

  it("counts the same recipe planned on two days of the week twice", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ title: "Pancakes", ingredients: "Flour" });
    await plan("2026-06-01", recipe.id);
    await plan("2026-06-03", recipe.id);

    await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Flour", amount: 2 });
    expect(await recipesBehind("Flour")).toEqual(["Pancakes"]);
  });

  it("merges with what a single recipe's own menu already put on the list", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ title: "Pancakes", ingredients: "Milk" });
    await prisma.listItem.create({ data: { listId: list.id, text: "Milk", position: 1 } });
    await plan("2026-06-01", recipe.id);

    await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    const items = await itemsOnList();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Milk", amount: 2 });
  });

  it("falls back to the live week when none is given", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "Flour" });
    await plan(todayInZone(new Date()), recipe.id);

    const result = await addMealPlanIngredients(formData({ listId: list.id }));

    expect(result).toEqual({ ok: true });
    expect((await itemsOnList()).map((item) => item.text)).toEqual(["Flour"]);
  });

  it("says so, and writes nothing, when nothing is cooking this week", async () => {
    const list = await listFor();
    await plan("2026-06-01", PLAN_OUT);

    const result = await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect(result).toEqual({ ok: false, error: "Nothing is being cooked this week yet." });
    expect(await prisma.listItem.count()).toBe(0);
  });

  it("says so, and writes nothing, when the week's recipes have no ingredients", async () => {
    const list = await listFor();
    const recipe = await recipeFor({ ingredients: "   \n  " });
    await plan("2026-06-01", recipe.id);

    const result = await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect(result).toEqual({
      ok: false,
      error: "None of this week's recipes have ingredients to add yet.",
    });
    expect(await prisma.listItem.count()).toBe(0);
  });

  it("refuses a list in a home the caller is not in", async () => {
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirList = await seedList({ homeId: elsewhere.id, createdById: neighbour.id });
    const recipe = await recipeFor({ ingredients: "Flour" });
    await plan("2026-06-01", recipe.id);

    await expectDenied(() =>
      addMealPlanIngredients(formData({ listId: theirList.id, week: WEEK })),
    );
    expect(await prisma.listItem.count()).toBe(0);
  });

  /**
   * The size case, which is the one that bites in production rather than in a fixture.
   *
   * A full week is seven recipes, not one, and each line of each of them is its own
   * round trip inside a single transaction — the amounts differ per line, so there is
   * no one statement that writes them. Prisma's default ceiling on an interactive
   * transaction is five seconds, and a week of real recipes against a pooled connection
   * can reach it; past it the write fails as P2028, nothing is saved, and the cook is
   * told only that something went wrong.
   *
   * So this plans a genuinely full week and asserts the whole of it landed. It is not a
   * benchmark — a local socket will never reproduce the latency that makes this fail —
   * but it is the shape of the call the ceiling applies to, and it fails loudly if the
   * work per line grows back.
   */
  it("writes a full week of distinct recipes in one go", async () => {
    const list = await listFor();
    const days = weekDays(WEEK);

    // Seven recipes of twelve lines each, sharing nothing, so every line is a row of
    // its own rather than an increment on one already there.
    const recipes = await Promise.all(
      days.map((day, index) =>
        recipeFor({
          title: `Dinner ${index + 1}`,
          ingredients: Array.from({ length: 12 }, (_, line) => `Item ${index + 1}-${line + 1}`).join("\n"),
        }).then(async (recipe) => {
          await plan(day, recipe.id);
          return recipe;
        }),
      ),
    );

    const result = await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect(result).toEqual({ ok: true });

    const items = await itemsOnList();
    expect(items).toHaveLength(7 * 12);
    // Every line names the one recipe that asked for it, which is the half written in a
    // single statement after the items rather than one upsert per line.
    expect(await prisma.listItemSource.count()).toBe(7 * 12);
    expect(await recipesBehind("Item 1-1")).toEqual([recipes[0]!.title]);
    expect(await recipesBehind("Item 7-12")).toEqual([recipes[6]!.title]);
  });

  it("never reaches into another home's meal plan", async () => {
    const list = await listFor();
    const elsewhere = await createHome();
    const neighbour = await createUser({ homeId: elsewhere.id });
    const theirRecipe = await createRecipe({
      homeId: elsewhere.id,
      createdById: neighbour.id,
      ingredients: "Flour",
    });
    await prisma.mealPlan.create({
      data: { homeId: elsewhere.id, date: "2026-06-01", recipeId: theirRecipe.id },
    });

    const result = await addMealPlanIngredients(formData({ listId: list.id, week: WEEK }));

    expect(result).toEqual({ ok: false, error: "Nothing is being cooked this week yet." });
  });
});
