import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";

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
