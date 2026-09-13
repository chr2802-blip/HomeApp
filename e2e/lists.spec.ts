import { ACCOUNTS, clickAndConfirm, expect, openDialog, test } from "./helpers/fixtures";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/lists");
});

test("the empty state invites you to make a first list", async ({ page }) => {
  await expect(page.getByText("No lists yet — create your first one with the button above.")).toBeVisible();
});

test("creating a list opens it", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Weekly shop");
  await page.getByRole("button", { name: "Create list" }).click();

  await expect(page).toHaveURL(/\/lists\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Weekly shop" })).toBeVisible();
  await expect(page.getByText("This list is empty.")).toBeVisible();
});

test("items can be added, ticked off and removed", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Groceries");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  for (const item of ["Milk", "Bread", "Eggs"]) {
    await page.getByPlaceholder("Add an item").fill(item);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }

  // Tick the first item off.
  const milkRow = page.locator("div").filter({ hasText: /^Milk/ }).last();
  await milkRow.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByRole("button", { name: "Mark as not done" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Clear 1 completed/ })).toBeVisible();

  // Clearing removes only the completed one.
  await page.getByRole("button", { name: /Clear 1 completed/ }).click();
  await expect(page.getByText("Milk", { exact: true })).toBeHidden();
  await expect(page.getByText("Bread", { exact: true })).toBeVisible();
  await expect(page.getByText("Eggs", { exact: true })).toBeVisible();
});

test("an item can be removed outright", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Hardware");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await page.getByPlaceholder("Add an item").fill("Screws");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Screws", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("This list is empty.")).toBeVisible();
});

test("a list can be renamed", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Old name");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await openDialog(page, "Edit");
  await page.getByLabel("List name").fill("New name");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "New name" })).toBeVisible();
});

test("deleting a list returns to the index and the list is gone", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Doomed list");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await clickAndConfirm(page, "Delete");

  await expect(page).toHaveURL(/\/lists$/);
  await expect(page.getByText("Doomed list")).toBeHidden();
});

test("the index shows open and total counts", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Counted");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  for (const item of ["One", "Two"]) {
    await page.getByPlaceholder("Add an item").fill(item);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Mark as done" }).first().click();
  await expect(page.getByRole("button", { name: "Mark as not done" })).toBeVisible();

  await page.goto("/lists");
  await expect(page.getByText("1 open · 2 total")).toBeVisible();
});
