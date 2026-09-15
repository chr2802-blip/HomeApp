import { ACCOUNTS, expect, openDialog, openMenu, test } from "./helpers/fixtures";

/*
 * A sheet's buttons are what it is for. On a phone, where the sheet fills the screen
 * and the longest forms in the app run well past it, the danger is that Save sits below
 * the fold: the form looks finished, nothing obvious happens, and people close it.
 *
 * So the body scrolls and the actions do not, and these tests are about exactly that —
 * measured against the viewport rather than read out of the markup, because "is it on
 * screen" is the question being asked.
 */
test.describe("a sheet on a phone-sized screen", () => {
  test.use({ viewport: { width: 390, height: 680 } });

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.member);
  });

  test("keeps a long form's actions on screen, before and after scrolling it", async ({ page }) => {
    await page.goto("/recipes");
    await openDialog(page, "New recipe");

    const save = page.getByRole("button", { name: "Save recipe" });
    const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancel" });
    await expect(save).toBeInViewport();
    await expect(cancel).toBeInViewport();

    // The recipe form is the longest in the app: its last field is far below the fold.
    await page.getByLabel("Instructions").scrollIntoViewIfNeeded();
    await expect(page.getByLabel("Instructions")).toBeInViewport();
    await expect(save).toBeInViewport();
    await expect(cancel).toBeInViewport();
  });

  test("shows a refused submission's reason beside the button that refused it", async ({ page }) => {
    await page.goto("/recipes");
    await openDialog(page, "New recipe");

    // A title and no category: refused by the action rather than by the browser, so the
    // reason comes back into a sheet that is still open and still scrolled to the top.
    await page.getByLabel("Title").fill("Nowhere to file this");
    await page.getByRole("button", { name: "Save recipe" }).click();

    const reason = page.getByText("Choose at least one category for this recipe.");
    await expect(reason).toBeVisible();
    await expect(reason).toBeInViewport();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a confirmation's own buttons are on screen too", async ({ page }) => {
    await page.goto("/lists");
    await openDialog(page, "New list");
    await page.getByLabel("List name").fill("Weekly shop");
    await page.getByRole("button", { name: "Create list" }).click();
    await page.waitForURL(/\/lists\/[a-z0-9]+$/);

    await openMenu(page);
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Delete", exact: true })).toBeInViewport();
    await expect(sheet.getByRole("button", { name: "Cancel" })).toBeInViewport();
  });
});
