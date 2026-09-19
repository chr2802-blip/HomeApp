import type { Locator } from "@playwright/test";
import { ACCOUNTS, clickAndConfirm, expect, openDialog, openMenu, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/lists");
});

test("the empty state invites you to make a first list", async ({ page }) => {
  await expect(
    page.getByText("Nothing on the shelf yet — create your first list with the button above."),
  ).toBeVisible();
});

test("creating a list opens it", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Weekly shop");
  await page.getByRole("button", { name: "Create list" }).click();

  await expect(page).toHaveURL(/\/lists\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Weekly shop" })).toBeVisible();
  await expect(page.getByText("This list is empty — add something below.")).toBeVisible();
});

test("ticking an item off folds it into the completed section", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Groceries");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  for (const item of ["Milk", "Bread", "Eggs"]) {
    await page.getByPlaceholder("Add an item").fill(item);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }

  // Nothing is completed yet, so there is no section to fold away.
  await expect(page.getByRole("button", { name: /Completed/ })).toHaveCount(0);

  const milkRow = page.locator("div").filter({ hasText: /^Milk/ }).last();
  await milkRow.getByRole("button", { name: "Mark as done" }).click();

  // The ticked item leaves the open list and is hidden inside the new section.
  const section = page.getByRole("button", { name: "Completed (1)" });
  await expect(section).toBeVisible();
  await expect(section).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Milk", { exact: true })).toBeHidden();
  await expect(page.getByText("Bread", { exact: true })).toBeVisible();
  await expect(page.getByText("Eggs", { exact: true })).toBeVisible();

  // Opening it shows the item again, still tickable.
  await section.click();
  await expect(section).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark as not done" }).click();
  await expect(page.getByRole("button", { name: /Completed/ })).toHaveCount(0);
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();
});

test("the completed section starts folded away on every visit", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Groceries");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await page.getByPlaceholder("Add an item").fill("Milk");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Mark as done" }).click();

  const section = page.getByRole("button", { name: "Completed (1)" });
  await section.click();
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: "Completed (1)" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByText("Milk", { exact: true })).toBeHidden();
});

test("there is no clear-completed button", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Groceries");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await page.getByPlaceholder("Add an item").fill("Milk");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();

  await expect(page.getByRole("button", { name: /Clear/ })).toHaveCount(0);
});

/**
 * What a bar is actually drawing, as the browser lays it out: the fraction of the track
 * its fill covers, and the colour that fill is painted in.
 *
 * Both can fail silently and separately. A fill whose `--chart-lists` resolved to
 * nothing is transparent — a bar reading 0% on a list that is nearly done — and a width
 * that never arrived is a bar telling the same lie with the colour intact. The number
 * in `data-progress` is what the bar says; this is what it shows.
 */
async function drawn(bar: Locator) {
  return bar.evaluate((track) => {
    const fill = track.firstElementChild as HTMLElement;
    return {
      ratio: fill.getBoundingClientRect().width / track.getBoundingClientRect().width,
      colour: getComputedStyle(fill).backgroundColor,
    };
  });
}

test("the list says how far along it is, and the bar draws what it says", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Weekend jobs");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  for (const item of ["Bins", "Washing"]) {
    await page.getByPlaceholder("Add an item").fill(item);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }

  await expect(page.getByText("0 of 2 ticked off")).toBeVisible();

  await page.getByRole("button", { name: "Mark as done" }).first().click();

  // The count is told by the same optimistic state the rows are, so it moves on the
  // press rather than on the answer — which is also why the row it belongs to is still
  // sliding away while this is already true.
  await expect(page.getByText("1 of 2 ticked off")).toBeVisible();

  const bar = page.locator("[data-progress]").first();
  await expect(bar).toHaveAttribute("data-progress", "50");
  await expect
    .poll(async () => Math.round((await drawn(bar)).ratio * 100))
    .toBe(50);
  expect((await drawn(bar)).colour).not.toBe("rgba(0, 0, 0, 0)");

  // And the card on the lists page says the same about the stored rows.
  await expect.poll(() => prisma().listItem.count({ where: { done: true } })).toBe(1);
  await page.goto("/lists");
  await expect(page.locator("[data-progress]").first()).toHaveAttribute("data-progress", "50");
});

test("the last tick clears the list and says so", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("One job");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await page.getByPlaceholder("Add an item").fill("Bins");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Bins", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark as done" }).click();

  await expect(page.getByText("All done 🎉")).toBeVisible();
  await expect(page.locator("[data-progress]").first()).toHaveAttribute("data-progress", "100");
  await expect(page.getByText("Nice — everything here is ticked off.")).toBeVisible();
});

test("an item can be removed outright", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Hardware");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await page.getByPlaceholder("Add an item").fill("Screws");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Screws", { exact: true })).toBeVisible();

  await clickAndConfirm(page, "Remove");
  await expect(page.getByText("This list is empty — add something below.")).toBeVisible();
});

test("a list can be renamed", async ({ page }) => {
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Old name");
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  await openMenu(page);
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

  await openMenu(page);
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
  // The ticked item is folded away, which is how we know the press was seen.
  await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();

  // But a tick is optimistic: the item folds away the instant it is pressed, before the
  // action has been answered. The page about to be opened counts the *stored* items, so
  // what has to be waited on is the row — as the favourites do, and for the same reason.
  await expect.poll(() => prisma().listItem.count({ where: { done: true } })).toBe(1);

  await page.goto("/lists");
  await expect(page.getByText("1 open · 2 total")).toBeVisible();
});
