import { ACCOUNTS, expect, test } from "./helpers/fixtures";

/**
 * The baby log on a phone: started from nothing, then written to with the three big
 * buttons, the way it is used at three in the morning.
 */
test.describe("the baby log", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(ACCOUNTS.member);
    await page.goto("/baby");
    await page.getByLabel("The baby's name").fill("Ella");
    await page.getByRole("button", { name: "Start the log" }).click();
    await expect(page.getByRole("heading", { name: "Ella", level: 1 })).toBeVisible();
  });

  test("starts and ends a sleep with one button, and says so at the top", async ({ page }) => {
    const sleep = page.locator("[data-baby-dock=sleep]");
    await sleep.click();
    await expect(sleep).toContainText("Awake");
    await expect(page.locator("[data-baby-tile=sleep]")).toContainText("Asleep");
    await expect(page.locator("[data-baby-entry=SLEEP]")).toContainText("Asleep now");

    await sleep.click();
    await expect(sleep).toContainText("Asleep now");
    await expect(page.locator("[data-baby-tile=sleep]")).toContainText("Awake");
  });

  test("logs a nappy and a bottle, newest first", async ({ page }) => {
    await page.locator("[data-baby-dock=diaper]").click();
    const nappy = page.getByRole("dialog", { name: "Nappy" });
    await nappy.getByText("Both", { exact: true }).click();
    await nappy.getByRole("button", { name: "Save" }).click();
    await expect(nappy).toHaveCount(0);
    await expect(page.locator("[data-baby-tile=diaper]")).toContainText("1 today");

    await page.locator("[data-baby-dock=feed]").click();
    const feed = page.getByRole("dialog", { name: "Feed" });
    await feed.getByText("Bottle", { exact: true }).click();
    await feed.getByLabel("Amount in ml").fill("120");
    await feed.getByRole("button", { name: "Save" }).click();
    await expect(feed).toHaveCount(0);

    await expect(page.locator("[data-baby-entry]").first()).toContainText("120 ml");
  });

  test("runs a breast feed's timer that outlives the sheet", async ({ page }) => {
    await page.locator("[data-baby-dock=feed]").click();
    const feed = page.getByRole("dialog", { name: "Feed" });
    await feed.getByRole("button", { name: /Left/ }).click();
    await expect(feed.getByRole("button", { name: /Left/ })).toHaveAttribute("aria-pressed", "true");

    // Closed and opened again — or reloaded — the feed is still running.
    await page.reload();
    await expect(page.locator("[data-baby-entry=FEED]")).toContainText("Feeding now");
    await page.locator("[data-baby-dock=feed]").click();
    await expect(page.getByRole("dialog", { name: "Feed" }).getByRole("button", { name: /Left/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("dialog", { name: "Feed" }).getByRole("button", { name: "Done · save" }).click();
    await expect(page.locator("[data-baby-entry=FEED]")).toContainText("Breastfeeding");
  });

  test("hides a kind that is turned off", async ({ page }) => {
    await page.getByRole("button", { name: "Baby settings" }).click();
    const settings = page.getByRole("dialog", { name: "Baby settings" });
    await settings.getByText("Nappies", { exact: true }).click();
    await settings.getByRole("button", { name: "Save settings" }).click();
    await expect(settings).toHaveCount(0);
    await expect(page.locator("[data-baby-dock=diaper]")).toHaveCount(0);
  });

  test("can be pinned to the tab bar", async ({ page }) => {
    await page.locator("nav.app-bottombar").getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "All tabs" });
    await drawer.getByRole("button", { name: "Pin Baby to the tab bar" }).click();
    await drawer.getByRole("button", { name: "Replace Lists" }).click();
    await expect(page.locator("nav.app-bottombar").getByRole("link")).toHaveText(["Home", "Food", "Baby"]);
  });
});
