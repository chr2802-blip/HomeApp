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

/** The row's tick, which is the row: the name is inside the control, not beside it. */
const entry = (page: Page, name: string) => page.getByRole("checkbox", { name });

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

  // Running out is an untick, not a delete — the entry stays, and the line goes back on
  // the shopping the next time a recipe asks for it.
  await retry(async () => {
    await entry(page, "Salt").click();
    await expect(entry(page, "Salt")).not.toBeChecked({ timeout: 1000 });
  });
  // And it is still out after a reload, which is the difference between a tick that
  // was written and one that was only drawn. The row says so in words too, beside a
  // box that would otherwise only be empty.
  await page.reload();
  await expect(entry(page, "Salt")).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Salt Run out" })).toBeVisible();

  // Renaming is the only edit there is, and it lives behind the three dots with the
  // delete — a destructive button beside a tick is a destructive button pressed by a
  // thumb aiming at the tick.
  await openMenu(page, { label: "Salt" });
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Havsalt");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(entry(page, "Havsalt")).toBeVisible();

  await openMenu(page, { label: "Havsalt" });
  await clickAndConfirm(page, "Delete", { confirmLabel: "Remove" });
  await expect(entry(page, "Havsalt")).toHaveCount(0);
});

test("a recipe leaves the pantry's own lines off the shopping list", async ({ page }) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");
  await keepIn(page, "Ris");
  await retry(async () => {
    // Out of rice, so rice is shopping again — the other half of the one bit an entry
    // carries.
    await entry(page, "Ris").click();
    await expect(entry(page, "Ris")).not.toBeChecked({ timeout: 1000 });
  });

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

test("a line naming two things the pantry only partly has is asked about, not guessed at", async ({
  page,
}) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");

  await newRecipe(page, "Karry", "Salt og peber\n500 g kylling");
  await addToList(page, "Groceries");

  const decision = page.getByRole("dialog", { name: "Already have some of this?" });
  await expect(decision).toBeVisible();
  await expect(decision.getByText("Salt already in the pantry.")).toBeVisible();

  // Left checked, the default, adds the line exactly as a press always used to.
  await decision.getByRole("button", { name: "Add checked" }).click();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Salt og peber", { exact: true })).toBeVisible();
  await expect(page.getByText("Kylling", { exact: true })).toBeVisible();
});

test("unchecking that line in the dialog leaves it off the list, same as a covered one", async ({
  page,
}) => {
  await newList(page, "Groceries");

  await page.goto("/pantry");
  await keepIn(page, "Salt");

  await newRecipe(page, "Karry", "Salt og peber\n500 g kylling");
  await addToList(page, "Groceries");

  const decision = page.getByRole("dialog", { name: "Already have some of this?" });
  await decision.getByRole("checkbox", { name: /Salt og peber/ }).uncheck();
  await decision.getByRole("button", { name: "Add checked" }).click();

  await expect(page.getByText("Salt og peber already in the pantry.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Groceries/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await expect(page.getByText("Kylling", { exact: true })).toBeVisible();
  await expect(page.getByText("Salt og peber", { exact: true })).toHaveCount(0);
});
