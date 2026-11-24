import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * The frame round every page: the "+" in the tab bar, the dashboard's banner, and the back
 * arrow that steps back to where a page was opened from.
 */
test.describe("the tab bar's +", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await loginAs(ACCOUNTS.member);
  });

  test("is the page's own button, named after what it makes", async ({ page }) => {
    await page.goto("/lists");
    await page.getByRole("button", { name: "New list", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "New list" })).toBeVisible();
  });

  test("offers what the other pages make where a page has nothing of its own", async ({ page }) => {
    await page.goto("/meals");
    const plus = page.getByRole("button", { name: "Create", exact: true });
    await plus.click();
    const drawer = page.getByRole("dialog", { name: "Create" });
    await drawer.getByRole("link", { name: "New list" }).click();
    await page.waitForURL(/\/lists$/);
    await expect(page.getByRole("dialog", { name: "New list" })).toBeVisible();
  });

  test("on the dashboard offers what the other pages make, and opens that page's sheet", async ({ page }) => {
    await page.goto("/dashboard");
    const plus = page.getByRole("button", { name: "Create", exact: true });
    await plus.click();
    await expect(plus).toHaveAttribute("aria-expanded", "true");
    const drawer = page.getByRole("dialog", { name: "Create" });
    await drawer.getByRole("link", { name: "New task" }).click();

    await page.waitForURL(/\/tasks$/);
    await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
    // The address was told to open the sheet once, and has forgotten it.
    expect(new URL(page.url()).search).toBe("");
  });
});

test.describe("the dashboard", () => {
  test("opens on a banner hanging from the header", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);
    await page.goto("/dashboard");
    const banner = page.locator(".home-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("the back arrow", () => {
  test("steps back to the page the list was opened from, not only one segment up", async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await loginAs(ACCOUNTS.member);
    await page.goto("/lists");
    await page.getByRole("button", { name: "New list", exact: true }).click();
    await page.getByLabel("List name").fill("Weekly shop");
    await page.getByRole("button", { name: "Create list" }).click();
    await page.waitForURL(/\/lists\/[a-z0-9]+$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Weekly shop/ }).first().click();
    await page.waitForURL(/\/lists\/[a-z0-9]+$/);
    await page.getByRole("link", { name: "Back" }).click();
    await page.waitForURL(/\/dashboard$/);
  });
});
