import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";
import { CATEGORIES, prisma } from "./helpers/database";
import type { Locator } from "@playwright/test";

/**
 * Invalid input used to be discarded without a word: the dialog closed as though it had
 * saved. These check that the reason is shown and the form stays put.
 *
 * Messages are asserted by their text rather than by role="alert": Next renders its own
 * route announcer with that role, so the role alone is not unique on the page.
 */

/**
 * Puts a value past an input's own validation, to reach the server check behind it.
 * Switching to a text input drops the numeric and date constraints that would
 * otherwise stop the form before it is ever submitted.
 */
async function forceValue(field: Locator, value: string) {
  await field.evaluate((node: HTMLInputElement) => {
    node.type = "text";
    for (const attribute of ["required", "minlength", "min", "max"]) {
      node.removeAttribute(attribute);
    }
  });
  await field.fill(value);
}

const INTERVAL_ERROR = "Repeat every 1 to 3650 days.";

test.describe("a rejected dialog submission", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.member);
    await page.goto("/tasks");
  });

  async function submitImpossibleInterval(page: Parameters<typeof openDialog>[0]) {
    await openDialog(page, "New task");
    await page.getByLabel("Task", { exact: true }).fill("Water the plants");
    await forceValue(page.getByLabel("Repeat every (days)"), "0");
    await page.getByRole("button", { name: "Add task" }).click();
  }

  test("keeps the dialog open and explains why", async ({ page }) => {
    await submitImpossibleInterval(page);

    await expect(page.getByText(INTERVAL_ERROR)).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await prisma().task.count()).toBe(0);
  });

  test("keeps what was already typed", async ({ page }) => {
    await openDialog(page, "New task");
    await page.getByLabel("Task", { exact: true }).fill("Water the plants");
    await page.getByLabel("Notes (optional)").fill("Both windowsills");
    await forceValue(page.getByLabel("Repeat every (days)"), "0");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText(INTERVAL_ERROR)).toBeVisible();

    // Nothing typed is lost when the submission is refused.
    await expect(page.getByLabel("Task", { exact: true })).toHaveValue("Water the plants");
    await expect(page.getByLabel("Notes (optional)")).toHaveValue("Both windowsills");
  });

  test("closes once the input is corrected", async ({ page }) => {
    await submitImpossibleInterval(page);
    await expect(page.getByText(INTERVAL_ERROR)).toBeVisible();

    await page.getByLabel("Repeat every (days)").fill("7");
    await page.getByRole("button", { name: "Add task" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Water the plants")).toBeVisible();
    expect(await prisma().task.count()).toBe(1);
  });

  test("does not carry the error into the next dialog", async ({ page }) => {
    await submitImpossibleInterval(page);
    await expect(page.getByText(INTERVAL_ERROR)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await openDialog(page, "New task");

    await expect(page.getByText(INTERVAL_ERROR)).toBeHidden();
  });
});

test.describe("a rejected recipe", () => {
  test("reports a video link it cannot understand", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);
    await page.goto("/recipes/new");

    await page.getByLabel("Title").fill("Pasta");
    // A category is required, and the action would refuse the recipe over that before
    // it ever got to judge the video link.
    await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).check({ force: true });
    await forceValue(
      page.getByLabel("Video link (Instagram, YouTube, TikTok…)"),
      "ftp://example.com/clip",
    );
    await page.getByRole("button", { name: "Save recipe" }).click();

    await expect(page.getByText("That video link is not a valid web address.")).toBeVisible();
    expect(await prisma().recipe.count()).toBe(0);
  });
});

test.describe("the profile form", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/profile");
  });

  test("confirms a successful change", async ({ page }) => {
    await page.getByLabel("Name", { exact: true }).fill("Ada Renamed");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("rejects a short password and keeps the stored name", async ({ page }) => {
    await page.getByLabel("Name", { exact: true }).fill("Ada Renamed");
    await forceValue(page.getByLabel("New password"), "short");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("A new password must be at least 8 characters.")).toBeVisible();

    // Nothing was written, so the name the person typed was not quietly saved either.
    const stored = await prisma().user.findUniqueOrThrow({
      where: { email: ACCOUNTS.admin.email },
    });
    expect(stored.name).toBe(ACCOUNTS.admin.name);
  });

});

test.describe("the home form", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");
  });

  test("reports a blank home name", async ({ page }) => {
    await forceValue(page.getByLabel("Home name"), "");
    await page.getByRole("button", { name: "Save home" }).click();

    await expect(page.getByText("Give the home a name.")).toBeVisible();
  });
});
