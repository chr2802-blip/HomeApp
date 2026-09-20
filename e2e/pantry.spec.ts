import type { Page } from "@playwright/test";
import {
  ACCOUNTS,
  clickAndConfirm,
  expect,
  openDialog,
  openHomeMenu,
  openMenu,
  SAVED_RECIPE,
  test,
} from "./helpers/fixtures";
import { CATEGORIES } from "./helpers/database";

/**
 * The household's basic goods, kept from the header's own menu and read again by the
 * button that puts a recipe on a shopping list.
 *
 * The second half is the whole point and the half a unit test cannot see: a page that
 * stores "Salt" perfectly and still puts salt on the shopping is a pantry nobody would
 * keep for a week.
 */

/** The row's switch, which is also where its name is read from. */
const entry = (page: Page, name: string) => page.getByRole("switch", { name, exact: true });

/**
 * Presses a control until it takes.
 *
 * Nothing in the markup says when React has hydrated — the server renders the same
 * button either way — so keep offering the press until the page shows what it should.
 */
async function retry(attempt: () => Promise<void>) {
  await expect(attempt).toPass({ timeout: 20_000 });
}

async function keepIn(page: Page, name: string) {
  await page.getByLabel("Something you keep in").fill(name);
  await page.getByRole("button", { name: "Add to pantry" }).click();
  await expect(entry(page, name)).toBeVisible();
}

/** Switches something off, which is the household saying it has run out of it. */
async function runOut(page: Page, name: string) {
  await retry(async () => {
    await entry(page, name).click();
    await expect(entry(page, name)).not.toBeChecked({ timeout: 1000 });
  });
}

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
  await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).check({ force: true });
  await page.getByLabel("Ingredients").fill(ingredients);
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);
}

async function addToList(page: Page, listTitle: string) {
  const trigger = page.getByRole("button", { name: "Add to list" });
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await page.getByRole("menuitem", { name: new RegExp(`^${listTitle}`) }).click();
}

test.beforeEach(async ({ loginAs }) => {
  // The plain member, not the admin: the cupboard is not administration, and the person
  // who finds the rice jar empty is not necessarily the one who runs the house.
  await loginAs(ACCOUNTS.member);
});

test("the pantry is reached from the home's own name, and kept there", async ({ page }) => {
  await page.goto("/dashboard");
  await openHomeMenu(page);
  await page.getByRole("menuitem", { name: "Pantry" }).click();
  await page.waitForURL("/pantry");

  await keepIn(page, "Salt");
  await expect(entry(page, "Salt")).toBeChecked();

  // Running out is a switch, not a delete — the entry stays, and the line goes back on
  // the shopping the next time a recipe asks for it.
  await runOut(page, "Salt");
  // And it is still out after a reload, which is the difference between a switch that
  // was written and one that was only drawn.
  await page.reload();
  await expect(entry(page, "Salt")).not.toBeChecked();
  await expect(page.getByText("Run out", { exact: true })).toBeVisible();

  // The name is edited by pressing it, the way a list item's is — no menu, no sheet, no
  // Save. Delete keeps the three dots to itself.
  await retry(async () => {
    await page.getByRole("button", { name: "Edit Salt" }).click();
    await expect(page.getByLabel("Edit Salt")).toBeVisible({ timeout: 1000 });
  });
  await page.getByLabel("Edit Salt").fill("Havsalt");
  await page.getByLabel("Edit Salt").press("Enter");
  await expect(entry(page, "Havsalt")).toBeVisible();
  // The rename moved the entry, it did not switch it back on.
  await expect(entry(page, "Havsalt")).not.toBeChecked();

  await openMenu(page, { label: "Havsalt" });
  await clickAndConfirm(page, "Delete", { confirmLabel: "Remove" });
  await expect(entry(page, "Havsalt")).toHaveCount(0);
});

test("a name the household already keeps is refused, and the row says what it says", async ({
  page,
}) => {
  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Sukker");

  await retry(async () => {
    await page.getByRole("button", { name: "Edit Sukker" }).click();
    await expect(page.getByLabel("Edit Sukker")).toBeVisible({ timeout: 1000 });
  });
  await page.getByLabel("Edit Sukker").fill("salt");
  await page.getByLabel("Edit Sukker").press("Enter");

  await expect(page.getByText("“salt” is already in the pantry.")).toBeVisible();
  await expect(entry(page, "Sukker")).toBeVisible();
});

test("a recipe leaves the pantry's own lines off the shopping list", async ({ page }) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Ris");
  // Out of rice, so rice is shopping again — the other half of the one bit an entry
  // carries.
  await runOut(page, "Ris");

  await newRecipe(page, "Karry", "2 tsk salt\n2 dl ris\n500 g kylling");
  await addToList(page, "Groceries");

  // What was left out is said where the press happened: a line that quietly never
  // arrives reads as one the app forgot.
  await expect(page.getByText("Salt already in the pantry.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Kylling", { exact: true })).toBeVisible();
  await expect(page.getByText("Ris", { exact: true })).toBeVisible();
  await expect(page.getByText("Salt", { exact: true })).toHaveCount(0);
});

test("everything that has run out goes onto a list in one press", async ({ page }) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Ris");
  await keepIn(page, "Mel");
  await runOut(page, "Ris");
  await runOut(page, "Mel");

  await addToList(page, "Groceries");
  await expect(page.getByText("Added to Groceries.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Ris", { exact: true })).toBeVisible();
  await expect(page.getByText("Mel", { exact: true })).toBeVisible();
  // What is in the cupboard was never the question.
  await expect(page.getByText("Salt", { exact: true })).toHaveCount(0);
});
