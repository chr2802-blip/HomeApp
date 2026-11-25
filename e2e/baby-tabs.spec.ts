import { ACCOUNTS, ROUTES_REQUESTS, expect, test } from "./helpers/fixtures";

// The test watches the page's own requests, which a service worker could take instead.
test.use(ROUTES_REQUESTS);

/**
 * The baby log's two tabs: the "+" does the same on both, and each keeps the other fetched
 * so a switch draws at once rather than after the server has answered.
 */
test.describe("the baby log's two tabs", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(ACCOUNTS.member);
  });

  test("keep each other fetched, and the charts' + writes to the log", async ({ page }) => {
    // The charts are asked for in full before anybody presses their tab.
    const charts = page.waitForRequest(
      (request) => new URL(request.url()).pathname === "/baby/charts" && request.headers()["rsc"] === "1",
    );
    await page.goto("/baby");
    await page.getByLabel("The baby's name").fill("Ella");
    await page.getByRole("button", { name: "Start the log" }).click();
    await expect(page.getByRole("heading", { name: "Ella", level: 1 })).toBeVisible();
    await charts;

    const log = page.waitForRequest(
      (request) => new URL(request.url()).pathname === "/baby" && request.headers()["rsc"] === "1",
    );
    await page.getByRole("link", { name: "Charts", exact: true }).click();
    await expect(page).toHaveURL(/\/baby\/charts$/);
    await log;

    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByRole("dialog", { name: "New entry" }).getByRole("button", { name: "Nappy" }).click();
    const nappy = page.getByRole("dialog", { name: "Nappy" });
    await nappy.getByText("Both", { exact: true }).click();
    await nappy.getByRole("button", { name: "Save" }).click();
    await expect(nappy).toHaveCount(0);

    await page.getByRole("link", { name: "Log", exact: true }).click();
    await expect(page).toHaveURL(/\/baby$/);
    await expect(page.locator("[data-baby-tile=diaper]")).toContainText("1 today");
  });
});
