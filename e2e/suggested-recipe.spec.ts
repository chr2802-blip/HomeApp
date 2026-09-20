import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";
import { todayInZone } from "../src/lib/time";

async function seedRecipe(title: string, categoryNames: string[] = [CATEGORIES[0]]) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const categories = await db.recipeCategory.findMany({
    where: { homeId: home.id, name: { in: categoryNames } },
    select: { id: true },
  });

  return db.recipe.create({
    data: {
      homeId: home.id,
      createdById: owner.id,
      title,
      ingredients: "Something",
      instructions: "Cook it.",
      categories: { create: categories.map(({ id }) => ({ categoryId: id })) },
    },
  });
}

async function excludeCategory(name: string) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  await db.recipeCategory.update({
    where: { homeId_name: { homeId: home.id, name } },
    data: { excludeFromSuggestion: true },
  });
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("says nothing on the dashboard when there is nothing to suggest", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tonight's dinner" })).toHaveCount(0);
});

test("suggests a recipe and remembers it across a reload", async ({ page }) => {
  const recipe = await seedRecipe("Pancakes");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tonight's dinner" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pancakes" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Pancakes" })).toBeVisible();

  await page.getByRole("link", { name: "Pancakes" }).click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
});

test("is a row on the dashboard, not a picture that fills the first screen", async ({ page }) => {
  await seedRecipe("Pancakes");

  // A task and a list, so the page holds what it usually does.
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  await db.task.create({
    data: {
      homeId: home.id,
      createdById: owner.id,
      title: "Water the plants",
      intervalDays: 7,
      nextDueAt: new Date(),
    },
  });
  await db.list.create({ data: { homeId: home.id, createdById: owner.id, title: "Weekly shop" } });

  await page.setViewportSize({ width: 390, height: 680 });
  await page.goto("/dashboard");

  const dinner = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Tonight's dinner" }) });
  await expect(dinner).toBeVisible();

  // The suggestion opened with the recipe's photograph across the full width, which on
  // a phone came to about two hundred pixels — with the title, the description and a
  // full-width button under it, half the first screen went on the dinner. The number is
  // loose on purpose: what it catches is a hero coming back, not a line of padding.
  const box = await dinner.boundingBox();
  expect(box!.height).toBeLessThan(160);

  // Which is the point of the number: everything the page is actually for is on the
  // first screen with it — the week, the dinner, what is due, and the lists.
  for (const heading of ["This week", "Tonight's dinner", "Due for you", "Recent lists"]) {
    const found = page.getByText(heading, { exact: false }).first();
    const seen = await found.boundingBox();
    expect(seen!.y, `"${heading}" is below the fold`).toBeLessThan(680);
  }
});

test("Find new switches to the other eligible recipe", async ({ page }) => {
  await seedRecipe("Pancakes");
  await seedRecipe("Lasagne");

  await page.goto("/dashboard");
  const suggestionTitle = () => page.locator("main p.font-medium").first().innerText();

  const before = await suggestionTitle();
  expect(["Pancakes", "Lasagne"]).toContain(before);

  await page.getByRole("button", { name: "Find new" }).click();
  await expect.poll(suggestionTitle, { timeout: 5000 }).not.toBe(before);
  expect(["Pancakes", "Lasagne"]).toContain(await suggestionTitle());
});

test("never suggests a recipe filed only under an excluded category", async ({ page }) => {
  await excludeCategory(CATEGORIES[0]);
  await seedRecipe("Baby purée", [CATEGORIES[0]]);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tonight's dinner" })).toHaveCount(0);

  await seedRecipe("Feta pasta", [CATEGORIES[1]]);
  await page.reload();
  await expect(page.getByRole("link", { name: "Feta pasta" })).toBeVisible();
});

test("shows a recipe already planned by hand on /meals, still with Find new", async ({ page }) => {
  const recipe = await seedRecipe("Pancakes");
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  await db.mealPlan.create({ data: { homeId: home.id, date: todayInZone(), recipeId: recipe.id } });

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Pancakes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find new" })).toBeVisible();
});

test("says nothing when tonight is already an eating-out night", async ({ page }) => {
  await seedRecipe("Pancakes");
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  await db.mealPlan.create({ data: { homeId: home.id, date: todayInZone() } });

  await page.goto("/dashboard");
  // A night out is a decision already made, not something to suggest instead of.
  await expect(page.getByRole("heading", { name: "Tonight's dinner" })).toHaveCount(0);
});

test("shows leftovers as what they are the leftovers of, with no Find new", async ({ page }) => {
  const lasagne = await seedRecipe("Lasagne");
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const yesterday = todayInZone(new Date(Date.now() - 24 * 60 * 60 * 1000));
  await db.mealPlan.create({ data: { homeId: home.id, date: yesterday, recipeId: lasagne.id } });
  await db.mealPlan.create({ data: { homeId: home.id, date: todayInZone(), leftoverOf: yesterday } });

  await page.goto("/dashboard");
  await expect(page.getByText(/Leftovers.*Lasagne/)).toBeVisible();
  // Overriding a leftovers day with a random pick would be arguing with a decision the
  // household already made on /meals.
  await expect(page.getByRole("button", { name: "Find new" })).toHaveCount(0);
});
