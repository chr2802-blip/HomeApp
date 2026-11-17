import type { Page } from "@playwright/test";
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

/** Presses and holds a recipe's card until choosing starts — a tap would open it. */
async function hold(page: Page, title: string) {
  const card = page.locator("main .grid a").filter({ hasText: title });
  await expect(card).toBeVisible();
  // The hold is a pointer listener React attaches; the card's three dots say when.
  await expect(page.getByRole("button", { name: `Actions for ${title}` })).toHaveAttribute("data-ready", "true");
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
  await page.mouse.down();
  await expect(page.getByText("1 chosen")).toBeVisible();
  await page.mouse.up();
}

test("a press and hold starts choosing, and a tap then chooses another", async ({ page }) => {
  await seedRecipe("Soup");
  await seedRecipe("Stew");
  await page.goto("/recipes");

  await hold(page, "Soup");
  // The hold chose it rather than opening it.
  await expect(page).toHaveURL(/\/recipes$/);
  const grid = page.locator("main .grid");
  await expect(grid.getByRole("button", { name: /Soup/ })).toHaveAttribute("aria-pressed", "true");

  await grid.getByRole("button", { name: /Stew/ }).click();
  await expect(page.getByText("2 chosen")).toBeVisible();
  await grid.getByRole("button", { name: /Soup/ }).click();
  await expect(page.getByText("1 chosen")).toBeVisible();

  // Cancel leaves choosing, and the cards are links again.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("1 chosen")).toHaveCount(0);
  await expect(page.locator("main .grid a").filter({ hasText: "Soup" })).toBeVisible();
});

test("deletes the chosen recipes, after asking", async ({ page }) => {
  await seedRecipe("Soup");
  await seedRecipe("Stew");
  await seedRecipe("Cake");
  await page.goto("/recipes");

  await hold(page, "Soup");
  await page.locator("main .grid").getByRole("button", { name: /Stew/ }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Delete 2 recipes?")).toBeVisible();
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(sheet).toBeHidden();

  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByText("Cake")).toBeVisible();
  await expect(page.getByText("Soup")).toHaveCount(0);
  expect((await prisma().recipe.findMany({ select: { title: true } })).map((recipe) => recipe.title)).toEqual(["Cake"]);
});

test("puts the chosen recipes on a list", async ({ page }) => {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const list = await db.list.create({
    data: { homeId: home.id, createdById: owner.id, title: "Weekly shop", trackAmounts: true },
  });
  const soup = await seedRecipe("Soup");
  await db.recipe.update({ where: { id: soup.id }, data: { ingredients: "2 gulerødder" } });
  const stew = await seedRecipe("Stew");
  await db.recipe.update({ where: { id: stew.id }, data: { ingredients: "500 g oksekød" } });
  await page.goto("/recipes");

  await hold(page, "Soup");
  await page.locator("main .grid").getByRole("button", { name: /Stew/ }).click();
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Weekly shop/ }).click();
  await expect(page.getByText("Added to Weekly shop.")).toBeVisible();
  await expect(page.getByText("2 chosen")).toHaveCount(0);

  const items = await db.listItem.findMany({ where: { listId: list.id }, select: { text: true } });
  expect(items.map((item) => item.text).sort()).toEqual(["Gulerødder", "Oksekød"]);
});

test("files several recipes under a heading in one press", async ({ page }) => {
  const soup = await seedRecipe("Soup");
  const stew = await seedRecipe("Stew");
  await seedRecipe("Cake");
  await page.goto("/recipes");

  await hold(page, "Soup");
  const grid = page.locator("main .grid");
  await grid.getByRole("button", { name: /Stew/ }).click();
  await expect(page.getByText("2 chosen")).toBeVisible();

  await page.getByRole("button", { name: "Categories" }).click();
  const sheet = page.getByRole("dialog", { name: "Add categories" });
  await sheet.getByText(CATEGORIES[1], { exact: true }).click();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Filed 2 recipes")).toBeVisible();

  // Out of choosing, and the filter for the heading now counts both.
  await expect(page.getByText("2 chosen")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `${CATEGORIES[1]}, 2 recipes` })).toBeVisible();
  const links = await prisma().recipeCategoryLink.findMany({
    where: { recipeId: { in: [soup.id, stew.id] } },
    select: { category: { select: { name: true } } },
  });
  expect(links.map((link) => link.category.name).sort()).toEqual(
    [CATEGORIES[0], CATEGORIES[0], CATEGORIES[1], CATEGORIES[1]].sort(),
  );
});
