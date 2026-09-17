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

/** `rgb(240, 249, 255)` as `#f0f9ff`, so a computed colour can be read against a hex. */
function asHex(colour: string) {
  const [red, green, blue] = colour.match(/\d+/g)!.map(Number);
  return `#${[red, green, blue]
    .map((channel) => channel!.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * That the top of the screen is one bar and not two, which is three separate things
 * agreeing on one colour: the header, the document behind it — what a home screen app
 * paints the strip holding the clock and the battery with — and the tag a browser tints
 * its own chrome from. Any two of them could match while the third goes its own way, and
 * on a phone that shows up as a seam a millimetre above the header.
 */
async function expectOneBar(page: Page, hex: string) {
  await expect(barOf(page)).toHaveAttribute("content", hex);

  const canvas = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(asHex(canvas)).toBe(hex);

  const header = page.locator("header");
  if ((await header.count()) > 0) {
    const painted = await header.evaluate((element) => getComputedStyle(element).backgroundColor);
    // Flat, not frosted: an `rgba(…, 0.85)` here is a header that changes colour as the
    // page scrolls under it, which no status bar can follow.
    expect(painted).not.toMatch(/rgba/);
    expect(asHex(painted)).toBe(hex);
  }
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
    // The bar above the header moves with it, and is the same colour the header is.
    await expectOneBar(page, "#f0f9ff");
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
    await expectOneBar(page, "#fafaf9");
  });
});

test("the login page wears the app's own colours, belonging to no home", async ({ page }) => {
  await dress(HOME_NAME, "PLUM");
  await page.goto("/login");

  await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");
  await expectOneBar(page, "#ffffff");
});
