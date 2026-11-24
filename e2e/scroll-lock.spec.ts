import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * A sheet stops the page under it scrolling while it is open, and gives scrolling back
 * when it closes — however the sheets overlap. A sheet that opens while another is
 * still sliding away is the case that used to leave the whole app unable to scroll.
 */
test.describe("scrolling after sheets", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(ACCOUNTS.member);
  });

  const bodyOverflow = (page: import("@playwright/test").Page) =>
    page.evaluate(() => document.body.style.overflow);

  test("comes back after the tab bar's + opens another page's sheet", async ({ page }) => {
    await page.goto("/meals");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("dialog", { name: "Create" }).getByRole("link", { name: "New list" }).click();
    const sheet = page.getByRole("dialog", { name: "New list" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => bodyOverflow(page)).toBe("");
  });

  test("comes back after one sheet hands over to the next", async ({ page }) => {
    await page.goto("/baby");
    await page.getByLabel("The baby's name").fill("Ella");
    await page.getByRole("button", { name: "Start the log" }).click();
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByRole("dialog", { name: "New entry" }).getByRole("button", { name: "Nappy" }).click();
    const sheet = page.getByRole("dialog", { name: "Nappy" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => bodyOverflow(page)).toBe("");
  });
});
