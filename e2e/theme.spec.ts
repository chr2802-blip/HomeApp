import { ACCOUNTS, expect, openHomeMenu, test } from "./helpers/fixtures";
import { HOME_NAME, OTHER_HOME_NAME, prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/**
 * A home's own colour, through the browser.
 *
 * The colour is on the document itself, so what it is worth asserting is exactly that:
 * a page can only be wearing one theme, and every band, pill and button on it reads its
 * colours from there. Which of the six a household picked is on <html>, and the check
 * that each one actually draws something lives in tests/unit/theme.test.ts — a CSS
 * variable nobody defined looks, from here, precisely like one that works.
 */

/** Puts a seeded account into a second home, which the fixed cast does not start with. */
async function alsoJoin(email: string, homeName: string) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: homeName } });
  const user = await db.user.findFirstOrThrow({ where: { email } });
  await db.homeMember.create({ data: { userId: user.id, homeId: home.id, role: "USER" } });
  return home;
}

/** Dresses a home directly, standing in for an admin who has already been to Settings. */
function dress(homeName: string, theme: "OCEAN" | "PLUM" | "SAND") {
  return prisma().home.updateMany({ where: { name: homeName }, data: { theme } });
}

const themeOf = (page: Page) => page.locator("html");

/**
 * What the phone paints its status bar with. Read from the document rather than from
 * the palette, because the point of the assertion is that the tag is there at all and
 * carries this home's band — a meta tag that quietly stopped being rendered looks, from
 * every other test, exactly like one that works.
 */
const barOf = (page: Page) => page.locator('meta[name="theme-color"]');

/**
 * What the document itself is painted in, which is what a home screen app paints the
 * strip holding the clock and the battery with — it has no chrome for the tag above to
 * colour. Asserted beside the tag rather than instead of it: the two colour the top of
 * the screen on different phones, and the seam is either of them going its own way.
 */
const canvasOf = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

/** `rgb(240, 249, 255)` as `#f0f9ff`, so a computed colour can be read against a hex. */
function asHex(colour: string) {
  const [red, green, blue] = colour.match(/\d+/g)!.map(Number);
  return `#${[red, green, blue]
    .map((channel) => channel!.toString(16).padStart(2, "0"))
    .join("")}`;
}

test.describe("as a home admin", () => {
  test("picks the colour the whole household is then dressed in", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");

    // Every home starts in the app's own colours.
    await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");

    await page.getByRole("radio", { name: "Ocean" }).check();
    await page.getByRole("button", { name: "Save home" }).click();

    await expect(themeOf(page)).toHaveAttribute("data-theme", "OCEAN");
    // The bar above the header moves with it, so the top of the screen is one colour
    // rather than two — in a browser, which tints its chrome from the tag, and in an
    // installed app, which takes that strip from the document's own background.
    await expect(barOf(page)).toHaveAttribute("content", "#f1f9ff");
    expect(asHex(await canvasOf(page))).toBe("#f1f9ff");
    // Stored, not merely on screen: it survives the page being asked for again.
    await page.reload();
    await expect(themeOf(page)).toHaveAttribute("data-theme", "OCEAN");
    await expect(page.getByRole("radio", { name: "Ocean" })).toBeChecked();
  });

  test("dresses the home for everybody in it, not just whoever picked", async ({
    page,
    loginAs,
  }) => {
    await dress(HOME_NAME, "PLUM");

    await loginAs(ACCOUNTS.member);

    await expect(themeOf(page)).toHaveAttribute("data-theme", "PLUM");
  });
});

test.describe("somebody in two homes", () => {
  test("carries the colour with them when they switch", async ({ page, loginAs }) => {
    await alsoJoin(ACCOUNTS.member.email, OTHER_HOME_NAME);
    await dress(HOME_NAME, "PLUM");
    await dress(OTHER_HOME_NAME, "SAND");

    await loginAs(ACCOUNTS.member);
    await expect(themeOf(page)).toHaveAttribute("data-theme", "PLUM");

    await openHomeMenu(page);
    await page.getByRole("menuitem", { name: OTHER_HOME_NAME }).click();

    await expect(
      page.getByRole("button", { name: `${OTHER_HOME_NAME} — home menu` }),
    ).toBeVisible();
    await expect(themeOf(page)).toHaveAttribute("data-theme", "SAND");
    await expect(barOf(page)).toHaveAttribute("content", "#fafaf9");
    expect(asHex(await canvasOf(page))).toBe("#fafaf9");
  });
});

test("the login page wears the app's own colours, belonging to no home", async ({ page }) => {
  await dress(HOME_NAME, "PLUM");
  await page.goto("/login");

  await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");
  await expect(barOf(page)).toHaveAttribute("content", "#fefeff");
  expect(asHex(await canvasOf(page))).toBe("#fefeff");
});
