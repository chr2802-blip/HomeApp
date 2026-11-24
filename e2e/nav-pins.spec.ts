import type { Locator } from "@playwright/test";
import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * Drags tab `name` by its grip and lets go over the row of tab `onto`, or — for null — on
 * the heading above the rows, where there is nothing to drop on. In steps, because
 * dnd-kit starts a drag only past its 6px and then follows the pointer's moves.
 */
async function drag(scope: Locator, name: string, onto: string | null) {
  await expect(scope.locator("[data-pins-ready]")).toBeVisible();
  const page = scope.page();
  // Measured on screen: off it, the mouse lands on nothing and only selects text. The
  // grip is scrolled to first, then the places above it, so both are in view at once.
  const handle = scope.getByRole("button", { name: `Move ${name}`, exact: true });
  await handle.scrollIntoViewIfNeeded();
  await scope.getByText("In the tab bar", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const grip = await handle.boundingBox();
  const target = await (onto
    ? scope.locator(`[data-pin-row="${onto}"]`)
    : scope.getByText("In the tab bar", { exact: true })
  ).boundingBox();
  if (!grip || !target) throw new Error("Nothing to drag, or nowhere to drop it.");
  const x = grip.x + grip.width / 2;
  await page.mouse.move(x, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, grip.y + grip.height / 2 - 10, { steps: 3 });
  await page.mouse.move(x, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

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

  test("takes a place when a tab is dragged onto it, and the old one drops down", async ({ page }) => {
    await page.goto("/tasks");
    await bar(page).getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "All tabs" });
    await drag(drawer, "Tasks", "lists");

    // Under the thumb, and the page it is on is now in the bar — lit there once the
    // menu, lit while it is open, has closed. Lists is among the others now.
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Food", "Tasks"]);
    await expect(drawer.locator('[data-pin-row="lists"]')).not.toContainText("Place");
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(lit(page, "Tasks")).toHaveCSS("scale", "1.1");

    await page.reload();
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Food", "Tasks"]);
  });

  test("swaps the two places when one is dragged onto the other", async ({ page }) => {
    await page.goto("/dashboard");
    await bar(page).getByRole("button", { name: "Menu" }).click();
    await drag(page.getByRole("dialog", { name: "All tabs" }), "Lists", "food");
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Lists", "Food"]);
  });

  test("lets go of nothing when dropped outside a row", async ({ page }) => {
    await page.goto("/dashboard");
    await bar(page).getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "All tabs" });
    await drag(drawer, "Tasks", null);
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Food", "Lists"]);
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
    await drag(page.locator("main"), "Tasks", "food");
    await expect(bar(page).getByRole("link")).toHaveText(["Home", "Tasks", "Lists"]);
  });
});
