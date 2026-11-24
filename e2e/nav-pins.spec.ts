import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * The phone's tab bar: Home, the person's two pins, the "+" and the menu — and the menu
 * that holds every tab and chooses the pins.
 */
test.describe("the tab bar", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await loginAs(ACCOUNTS.member);
  });

  const bar = (page: import("@playwright/test").Page) => page.locator("nav.app-bottombar");
  const lit = (page: import("@playwright/test").Page, name: string) =>
    bar(page).getByRole(name === "Menu" ? "button" : "link", { name, exact: true }).locator("span").first();

  test("holds Home, the two default pins and the menu", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Food", "Lists"]);
    await expect(bar(page).getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(lit(page, "Home")).toHaveCSS("scale", "1.1");
  });

  test("lights the menu on a tab that is not in it, and on a page outside the tabs", async ({ page }) => {
    await page.goto("/tasks");
    await expect(lit(page, "Menu")).toHaveCSS("scale", "1.1");
    await page.goto("/profile");
    await expect(lit(page, "Menu")).toHaveCSS("scale", "1.1");
  });

  test("pins a tab in place of another, and remembers it", async ({ page }) => {
    await page.goto("/tasks");
    await bar(page).getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "All tabs" });
    await drawer.getByRole("button", { name: "Pin Tasks to the tab bar" }).click();
    await drawer.getByRole("button", { name: "Replace Lists" }).click();

    // Under the thumb, and the page it is on is now in the bar — lit there once the
    // menu, lit while it is open, has closed.
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Food", "Tasks"]);
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(lit(page, "Tasks")).toHaveCSS("scale", "1.1");

    await page.reload();
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Food", "Tasks"]);
  });

  test("swaps the two places", async ({ page }) => {
    await page.goto("/dashboard");
    await bar(page).getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "All tabs" }).getByRole("button", { name: "Swap the two" }).click();
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Lists", "Food"]);
  });

  test("goes to a tab that is not in the bar", async ({ page }) => {
    await page.goto("/dashboard");
    await bar(page).getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "All tabs" }).getByRole("link", { name: /^Tasks/ }).click();
    await page.waitForURL(/\/tasks$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(lit(page, "Menu")).toHaveCSS("scale", "1.1");
  });

  test("is chosen on the profile too", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Pin Tasks to the tab bar" }).click();
    await page.getByRole("button", { name: "Replace Food" }).click();
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Tasks", "Lists"]);
  });
});
