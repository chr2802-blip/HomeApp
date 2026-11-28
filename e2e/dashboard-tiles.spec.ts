import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * The dashboard's three tiles, each the person's own choice: empty until chosen, an empty
 * one says how to fill it, and holding any of them opens the chooser.
 */
test.describe("the dashboard's tiles", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await loginAs(ACCOUNTS.member);
  });

  test("start empty, and say how to fill them", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("[data-tile-empty]")).toHaveCount(3);
    await expect(page.locator("[data-tile-empty]").first()).toContainText("Press and hold to add a shortcut");
  });

  test("are filled by holding one, and stay filled", async ({ page }) => {
    await page.goto("/dashboard");
    const empty = page.locator("[data-tile-empty]").nth(1);
    const box = (await empty.boundingBox())!;
    // A hold, not a tap: the long press is what opens the chooser.
    await expect(async () => {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
      await expect(page.getByRole("dialog", { name: "Tile 2" })).toBeVisible({ timeout: 1000 });
    }).toPass();
    await page.getByRole("dialog", { name: "Tile 2" }).getByRole("button", { name: /Create recipe/ }).click();

    await expect(page.locator("[data-tiles]")).toHaveAttribute("data-tiles", "- recipe -");
    await expect(page.getByRole("link", { name: /New recipe/ })).toHaveAttribute("href", "/recipes?new");
    await page.reload();
    await expect(page.locator("[data-tiles]")).toHaveAttribute("data-tiles", "- recipe -");
  });

  test("are chosen on the profile too, and can be emptied again", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Change tile 1" }).click();
    await page.getByRole("dialog", { name: "Tile 1" }).getByRole("button", { name: /Start sleep/ }).click();
    await expect(page.locator('[data-tile-slot="1"]')).toContainText("Start sleep");

    await page.getByRole("button", { name: "Change tile 1" }).click();
    await page.getByRole("dialog", { name: "Tile 1" }).getByRole("button", { name: "Leave this tile empty" }).click();
    await expect(page.locator('[data-tile-slot="1"]')).toContainText("Empty");
    // The sheet takes its history entry back as it closes; a navigation under it aborts.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/dashboard");
    await expect(page.locator("[data-tile-empty]")).toHaveCount(3);
  });

  test("start a feed on a side, then offer pause and end, and the sides again once paused", async ({ page }) => {
    await page.goto("/baby");
    await page.getByLabel("The baby's name").fill("Ella");
    await page.getByRole("button", { name: "Start the log" }).click();
    await page.goto("/profile");
    await page.getByRole("button", { name: "Change tile 1" }).click();
    await page.getByRole("dialog", { name: "Tile 1" }).getByRole("button", { name: /Start breastfeed/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Left" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "End" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Left" })).toHaveCount(0);

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Right" })).toBeVisible();
    await expect(page.getByRole("button", { name: "paused · end" })).toBeVisible();

    await page.getByRole("button", { name: "Right" }).click();
    await page.getByRole("button", { name: "End" }).click();
    await expect(page.getByRole("button", { name: "Left" })).toBeVisible();
    await expect(page.locator("[data-tile-feed-finish]")).toHaveCount(0);
  });
});
