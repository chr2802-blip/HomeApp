import { ACCOUNTS, ROUTES_REQUESTS, expect, test } from "./helpers/fixtures";

// The test watches the page's own requests, which a service worker could take instead.
test.use(ROUTES_REQUESTS);

/**
 * The baby log's two tabs are one page drawn side by side (`SwipePager`): the charts are
 * there beside the log before anybody asks for them, a finger drags them in, and turning
 * fetches nothing. The "+" does the same on both.
 */
test.describe("the baby log's two tabs", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(ACCOUNTS.member);
    await page.goto("/baby");
    await page.getByLabel("The baby's name").fill("Ella");
    await page.getByRole("button", { name: "Start the log" }).click();
    await expect(page.getByRole("heading", { name: "Ella", level: 1 })).toBeVisible();
    // Something to chart: with nothing logged the charts say so instead of drawing.
    await page.locator("[data-baby-add=sleep]").click();
    await expect(page.locator("[data-baby-tile=sleep]")).toContainText("Asleep");
  });

  test("turn by the pill without fetching, and the charts' + writes to the log", async ({ page }) => {
    // Drawn already, just not on screen.
    // (Hidden from the accessibility tree while away, so asked for with that included.)
    await expect(
      page.locator("[data-pager-page=away]").getByRole("figure", { name: "Sleep around the clock", includeHidden: true }),
    ).toBeAttached();

    const fetched: string[] = [];
    page.on("request", (request) => {
      // A page asked for, not a link coming into view prefetching where it leads (the
      // charts' own Day/Week/Month do that the moment they are on screen).
      const headers = request.headers();
      if (headers["rsc"] === "1" && !headers["next-router-prefetch"]) fetched.push(request.url());
    });
    await page.locator("main nav").getByRole("link", { name: "Charts", exact: true }).click();
    await expect(page).toHaveURL(/\/baby\?tab=charts$/);
    await expect(page.locator("[data-pager-page=shown]").getByRole("figure", { name: "Sleep around the clock" })).toBeVisible();
    await expect(page.locator("main nav").getByRole("link", { name: "Charts", exact: true })).toHaveAttribute("aria-current", "page");
    expect(fetched).toEqual([]);

    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByRole("dialog", { name: "New entry" }).getByRole("button", { name: "Nappy" }).click();
    const nappy = page.getByRole("dialog", { name: "Nappy" });
    await nappy.getByText("Both", { exact: true }).click();
    await nappy.getByRole("button", { name: "Save" }).click();
    await expect(nappy).toHaveCount(0);
    // Saved from the charts' side: the address keeps its tab through the refresh.
    await expect(page).toHaveURL(/\/baby\?tab=charts$/);

    await page.locator("main nav").getByRole("link", { name: "Log", exact: true }).click();
    await expect(page).toHaveURL(/\/baby$/);
    await expect(page.locator("[data-baby-tile=diaper]")).toContainText("1 today");
  });

  test("the charts follow a finger in from the side, and land", async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: 700 }] });
    // The pager's second page.
    const charts = page.locator("[data-pager-page]").nth(1);

    await touch("touchStart", 330);
    for (let x = 320; x >= 160; x -= 20) await touch("touchMove", x);
    // Mid-swipe, still on the log: the charts are already on screen beside it.
    const box = (await charts.boundingBox())!;
    expect(box.x).toBeGreaterThan(0);
    expect(box.x).toBeLessThan(390);
    await expect(page).toHaveURL(/\/baby$/);

    await touch("touchEnd", 160);
    await expect(page).toHaveURL(/\/baby\?tab=charts$/);
    await expect.poll(async () => (await charts.boundingBox())!.x).toBe(0);
  });
});
