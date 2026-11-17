import { ACCOUNTS, expect, openMenu, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";

/*
 * What the recipe list does to recipes without opening any of them: an edit from a
 * card's three dots, and filing several under a heading at once.
 */

async function seedRecipe(title: string, categoryName: string = CATEGORIES[0]) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const category = await db.recipeCategory.findFirstOrThrow({ where: { homeId: home.id, name: categoryName } });
  return db.recipe.create({
    data: {
      homeId: home.id,
      createdById: owner.id,
      title,
      categories: { create: [{ categoryId: category.id }] },
    },
  });
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("an edit saved from the list closes over the list, where it was", async ({ page }) => {
  for (let index = 1; index <= 12; index++) await seedRecipe(`Recipe ${String(index).padStart(2, "0")}`);
  await page.goto("/recipes");

  // The oldest is drawn last, well down the page.
  const card = page.locator("main .grid > *").filter({ hasText: "Recipe 01" });
  await card.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);

  await openMenu(page, { within: card, label: "Recipe 01" });
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Title").fill("Recipe 01, renamed");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden();

  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByText("Recipe 01, renamed")).toBeInViewport();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrolled)).toBeLessThan(80);
});

test("files several recipes under a heading in one press", async ({ page }) => {
  const soup = await seedRecipe("Soup");
  const stew = await seedRecipe("Stew");
  await seedRecipe("Cake");
  await page.goto("/recipes");

  await page.getByRole("button", { name: "Choose" }).click();
  const grid = page.locator("main .grid");
  await grid.getByRole("button", { name: /Soup/ }).click();
  await grid.getByRole("button", { name: /Stew/ }).click();
  await expect(page.getByText("2 chosen")).toBeVisible();

  await page.getByRole("button", { name: "Add category" }).click();
  const sheet = page.getByRole("dialog", { name: "Add a category" });
  await sheet.getByText(CATEGORIES[1], { exact: true }).click();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Filed 2 recipes")).toBeVisible();

  // Out of choosing, and the filter for the heading now counts both.
  await expect(page.getByRole("button", { name: "Choose" })).toBeVisible();
  await expect(page.getByRole("button", { name: `${CATEGORIES[1]}, 2 recipes` })).toBeVisible();
  const links = await prisma().recipeCategoryLink.findMany({
    where: { recipeId: { in: [soup.id, stew.id] } },
    select: { category: { select: { name: true } } },
  });
  expect(links.map((link) => link.category.name).sort()).toEqual(
    [CATEGORIES[0], CATEGORIES[0], CATEGORIES[1], CATEGORIES[1]].sort(),
  );
});
