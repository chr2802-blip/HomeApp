import type { Page } from "@playwright/test";
import { ACCOUNTS, clickAndConfirm, expect, openMenu, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";

type Seed = {
  title: string;
  /** Every heading it is filed under; several is the point of the ones that have them. */
  categories: string[];
  ingredients?: string;
  description?: string;
};

/** Puts recipes in the home under categories the seed already created. */
async function seedRecipes(recipes: Seed[]) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

  for (const recipe of recipes) {
    const categories = await db.recipeCategory.findMany({
      where: { homeId: home.id, name: { in: recipe.categories } },
      select: { id: true },
    });
    await db.recipe.create({
      data: {
        homeId: home.id,
        createdById: owner.id,
        categories: { create: categories.map(({ id }) => ({ categoryId: id })) },
        title: recipe.title,
        description: recipe.description ?? null,
        ingredients: recipe.ingredients ?? "",
        instructions: "Cook it.",
      },
    });
  }
}

/** The recipe titles currently on the page, top to bottom. */
const shown = (page: Page) => page.locator("p.font-medium").allInnerTexts();

/**
 * The same, sorted, for the assertions that are about which recipes are on the page
 * rather than their order. Two recipes seeded in the same millisecond come back in
 * whichever order Postgres chose, and a test that happens to pass on that is a test
 * that will fail one morning for no reason.
 */
const shownSorted = async (page: Page) => (await shown(page)).sort();

/**
 * The category headings currently on the page as "name count", top to bottom. Read from
 * the two spans rather than the heading's own text, which the uppercase styling would
 * otherwise put through innerText.
 */
async function headings(page: Page) {
  const found = await page.locator("section > h2").all();
  return Promise.all(
    found.map(async (heading) => (await heading.locator("span").allTextContents()).join(" ")),
  );
}

/**
 * Presses a control until it takes.
 *
 * Nothing in the markup says when React has hydrated — the server renders the same
 * button either way — so keep offering the press until the page shows what it should.
 */
async function retry(attempt: () => Promise<void>) {
  await expect(attempt).toPass({ timeout: 20_000 });
}

test.describe("the recipes page", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.member);
    await seedRecipes([
      { title: "Sourdough", categories: ["Baking"], ingredients: "Flour\nWater\nSalt" },
      { title: "Cinnamon buns", categories: ["Baking"], ingredients: "Flour\nCinnamon" },
      { title: "Feta pasta", categories: ["Weeknight"], ingredients: "Feta\nTomatoes\nPasta" },
    ]);
    await page.goto("/recipes");
  });

  test("groups the recipes under their category headings", async ({ page }) => {
    expect(await headings(page)).toEqual(["Baking 2", "Weeknight 1"]);

    const baking = page.locator("section").filter({ has: page.getByRole("heading", { name: "Baking" }) });
    await expect(baking.getByText("Sourdough")).toBeVisible();
    await expect(baking.getByText("Feta pasta")).toHaveCount(0);
  });

  test("a recipe filed under two headings is shown under both", async ({ page }) => {
    await seedRecipes([{ title: "Lasagne", categories: ["Baking", "Weeknight"] }]);
    await page.reload();

    // It counts under each heading, so the numbers match what pressing them shows
    // rather than adding up to the number of recipes in the house.
    expect(await headings(page)).toEqual(["Baking 3", "Weeknight 2"]);

    for (const name of ["Baking", "Weeknight"]) {
      const section = page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name }) });
      await expect(section.getByText("Lasagne")).toBeVisible();
    }

    await retry(async () => {
      await page.getByRole("button", { name: "Weeknight, 2 recipes" }).click();
      await expect.poll(() => shownSorted(page), { timeout: 1000 }).toEqual(["Feta pasta", "Lasagne"]);
    });
  });

  test("a category filter narrows the page to that category", async ({ page }) => {
    await retry(async () => {
      await page.getByRole("button", { name: "Weeknight, 1 recipe" }).click();
      await expect.poll(() => shown(page), { timeout: 1000 }).toEqual(["Feta pasta"]);
    });

    expect(await headings(page)).toEqual(["Weeknight 1"]);

    // And back again — "All" is a filter like any other, not a reload.
    await page.getByRole("button", { name: "All, 3 recipes" }).click();
    await expect.poll(() => shown(page)).toHaveLength(3);
  });

  test("searching matches an ingredient, not only the title", async ({ page }) => {
    await retry(async () => {
      await page.getByLabel("Search recipes").fill("cinnamon");
      await expect.poll(() => shown(page), { timeout: 1000 }).toEqual(["Cinnamon buns"]);
    });

    // "Feta" appears in no title at all, only in what the recipe is made of.
    await page.getByLabel("Search recipes").fill("feta");
    await expect.poll(() => shown(page)).toEqual(["Feta pasta"]);
    expect(await headings(page)).toEqual(["Weeknight 1"]);
  });

  test("the filter and the search box narrow together", async ({ page }) => {
    await retry(async () => {
      await page.getByRole("button", { name: "Baking, 2 recipes" }).click();
      await expect
        .poll(() => shownSorted(page), { timeout: 1000 })
        .toEqual(["Cinnamon buns", "Sourdough"]);
    });

    // Both are made of flour, and both are in the category being shown.
    await page.getByLabel("Search recipes").fill("flour");
    await expect.poll(() => shownSorted(page)).toEqual(["Cinnamon buns", "Sourdough"]);

    // In the other category, and so excluded by the filter even though it matches.
    await page.getByLabel("Search recipes").fill("pasta");
    await expect.poll(() => shown(page)).toEqual([]);
  });

  test("says so when nothing matches", async ({ page }) => {
    await retry(async () => {
      await page.getByLabel("Search recipes").fill("nonsense");
      await expect(page.getByText("No recipe matches “nonsense”.")).toBeVisible({ timeout: 1000 });
    });
  });
});

test.describe("maintaining the categories", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");
  });

  /** The list of what has been made, which is what the section is for. */
  const listed = (page: Page) =>
    page.getByTestId("recipe-categories").locator("[data-category-row]");

  /** The green "+" in the section's heading, and the sheet behind it. */
  async function addCategory(page: Page, name: string) {
    await expect(async () => {
      await page.getByRole("button", { name: "Add category" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Name", { exact: true }).fill(name);
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
  }

  test("an admin adds a category and it can be chosen on a recipe", async ({ page }) => {
    await addCategory(page, "Desserts");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(listed(page).filter({ hasText: "Desserts" })).toHaveCount(1);

    await page.goto("/recipes/new");
    await expect(page.getByRole("checkbox", { name: "Desserts", exact: true })).toHaveCount(1);
  });

  test("a name the home already uses is reported rather than added twice", async ({ page }) => {
    await addCategory(page, CATEGORIES[0]);

    await expect(
      page.getByRole("dialog").getByText(`There is already a category called “${CATEGORIES[0]}”.`),
    ).toBeVisible();
  });

  test("renaming a category renames it everywhere", async ({ page }) => {
    await seedRecipes([{ title: "Sourdough", categories: ["Baking"] }]);
    await page.reload();
    await expect(listed(page).filter({ hasText: "Baking" })).toContainText("1 recipe");

    await openMenu(page, { label: "Baking" });
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Name", { exact: true }).fill("Bread");
    await sheet.getByRole("button", { name: "Save changes" }).click();
    await expect(sheet).toBeHidden();
    await expect(listed(page).filter({ hasText: "Bread" })).toHaveCount(1);

    await page.goto("/recipes");
    expect(await headings(page)).toEqual(["Bread 1"]);
  });

  /*
   * Every recipe must have a category, so one in use cannot be removed without deciding
   * what happens to what is inside it. Its menu still edits it, and offers no Delete.
   */
  test("a category holding recipes cannot be deleted, an empty one can", async ({ page }) => {
    await seedRecipes([{ title: "Sourdough", categories: ["Baking"] }]);
    await page.reload();

    await openMenu(page, { label: "Baking" });
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.reload();

    await openMenu(page, { label: "Weeknight" });
    await clickAndConfirm(page, "Delete");

    await expect(listed(page).filter({ hasText: "Weeknight" })).toHaveCount(0);
    await expect(listed(page).filter({ hasText: "Baking" })).toHaveCount(1);
  });
});
