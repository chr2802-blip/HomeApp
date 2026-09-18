import { ACCOUNTS, expect, openDialog, SAVED_RECIPE, test } from "./helpers/fixtures";
import { CATEGORIES } from "./helpers/database";
import type { Page } from "@playwright/test";

/**
 * A recipe's ingredients, put on a shopping list and read back there.
 *
 * The whole point of the feature is what the list looks like afterwards, so these go
 * through the real menu and then walk to the list to see what is on it.
 */

async function newList(page: Page, title: string) {
  await page.goto("/lists");
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill(title);
  await page.getByLabel("Track amounts").check();
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);
}

async function newRecipe(page: Page, title: string, ingredients: string) {
  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill(title);
  // The box itself is off screen — what a person presses is the chip beside it.
  await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).check({ force: true });
  await page.getByLabel("Ingredients").fill(ingredients);
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);
}

/**
 * Opens the recipe's "Add to list" menu and chooses one. Like every other menu here it
 * waits for the trigger to say it is really a menu button: hydration leaves no mark of
 * its own, so a press before React has attached looks exactly like a miss.
 */
async function addToList(page: Page, listTitle: string) {
  const trigger = page.getByRole("button", { name: "Add to list" });
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await page.getByRole("menuitem", { name: new RegExp(`^${listTitle}`) }).click();
  await expect(page.getByText(`Added to ${listTitle}.`)).toBeVisible();
}

/** The row for one item, which is the innermost box holding its text and its remove. */
const row = (page: Page, text: string) =>
  page
    .locator("div")
    .filter({ hasText: text })
    .filter({ has: page.getByRole("button", { name: "Remove" }) })
    .last();

const amountBox = (page: Page, of: string) =>
  page.getByRole("spinbutton", { name: `Amount for ${of}`, exact: true });

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("a recipe's ingredients go onto a chosen list, each naming the recipe", async ({ page }) => {
  await newList(page, "Groceries");
  await newRecipe(page, "Pancakes", "Milk\nFlour\n2 eggs");

  await addToList(page, "Groceries");

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  for (const item of ["Milk", "Flour", "2 eggs"]) {
    await expect(page.getByText(item, { exact: true })).toBeVisible();
    await expect(row(page, item).getByRole("link", { name: "Pancakes" })).toBeVisible();
  }
});

test("adding the same recipe again asks for one more of each, and still names it once", async ({
  page,
}) => {
  await newList(page, "Groceries");
  await newRecipe(page, "Pancakes", "Milk");

  await addToList(page, "Groceries");
  await addToList(page, "Groceries");

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();

  await expect(amountBox(page, "Milk")).toHaveValue("2");
  await expect(row(page, "Milk").getByRole("link", { name: "Pancakes" })).toHaveCount(1);
});

test("an item wanted by two recipes names both", async ({ page }) => {
  await newList(page, "Groceries");
  await newRecipe(page, "Pancakes", "Milk");
  await addToList(page, "Groceries");

  await newRecipe(page, "Risotto", "Milk\nRice");
  await addToList(page, "Groceries");

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();

  const milk = row(page, "Milk");
  await expect(milk.getByRole("link", { name: "Pancakes" })).toBeVisible();
  await expect(milk.getByRole("link", { name: "Risotto" })).toBeVisible();
});

test("ticking an item off drops the recipe behind it; a hand-typed item never had one", async ({
  page,
}) => {
  await newList(page, "Groceries");
  await newRecipe(page, "Pancakes", "Milk");
  await addToList(page, "Groceries");

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();

  await page.getByPlaceholder("Add an item").fill("Coffee");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Coffee", { exact: true })).toBeVisible();
  // Nobody asked for the coffee but the person who typed it, so nothing is claimed.
  await expect(row(page, "Coffee").getByRole("link", { name: "Pancakes" })).toHaveCount(0);

  await row(page, "Milk").getByRole("button", { name: "Mark as done" }).click();

  await page.getByRole("button", { name: "Completed (1)" }).click();
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pancakes" })).toHaveCount(0);
});

test("a recipe with nothing listed offers no way to add it", async ({ page }) => {
  await newList(page, "Groceries");
  await newRecipe(page, "Sunday roast", "");

  await expect(page.getByRole("button", { name: "Add to list" })).toHaveCount(0);
});
