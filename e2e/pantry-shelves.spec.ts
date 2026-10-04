import type { Page } from "@playwright/test";
import { ACCOUNTS, clickAndConfirm, expect, openMenu, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";

/**
 * A household's own pantry shelves: made by an admin in Settings, filed onto from the
 * pantry's own sheets, and — deleted — handing what was on them back to "Not sorted yet".
 */

async function retry(attempt: () => Promise<void>) {
  await expect(attempt).toPass({ timeout: 20_000 });
}

const shelf = (page: Page, id: string) => page.locator(`section[data-shelf="${id}"]`);

async function addShelf(page: Page, name: string) {
  await retry(async () => {
    await page.getByRole("button", { name: "Add shelf" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  });
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Name", { exact: true }).fill(name);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.admin);
});

test("an admin makes a shelf, things are filed on it, and deleting it unsorts them", async ({ page }) => {
  await page.goto("/settings");
  await addShelf(page, "Snacks");
  await expect(page.getByRole("dialog")).toBeHidden();
  const listed = page.getByTestId("pantry-shelves").locator("[data-category-row]");
  await expect(listed.filter({ hasText: "Snacks" })).toContainText("Empty");

  const { id } = await prisma().pantryShelf.findFirstOrThrow({ where: { name: "Snacks" } });

  // Chosen in the pantry's own add sheet, like any built-in shelf.
  await page.goto("/pantry");
  await retry(async () => {
    await page.getByRole("button", { name: "Add to supplies" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  });
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Something you keep in").fill("Crisps");
  await sheet.getByText("Snacks", { exact: true }).click();
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(shelf(page, id).getByRole("group", { name: "Quantity of Crisps" })).toBeVisible();
  await expect(shelf(page, id).locator("[data-shelf-toggle]")).toContainText("Snacks");

  await page.goto("/settings");
  await expect(listed.filter({ hasText: "Snacks" })).toContainText("1 thing");
  await openMenu(page, { label: "Snacks" });
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await clickAndConfirm(page, "Delete");
  await expect(listed.filter({ hasText: "Snacks" })).toHaveCount(0);

  await page.goto("/pantry");
  await expect(shelf(page, "UNSORTED")).toContainText("Crisps");
});

test("a shelf cannot take a built-in shelf's name", async ({ page }) => {
  await page.goto("/settings");
  await addShelf(page, "fridge");
  await expect(page.getByRole("dialog").getByText("There is already a shelf called “fridge”.")).toBeVisible();
});
