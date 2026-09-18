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

/** `rgb(229, 231, 235)` as `#e5e7eb`, so a computed colour can be read against a hex. */
function asHex(colour: string) {
  const [red, green, blue] = colour.match(/\d+/g)!.map(Number);
  return `#${[red, green, blue]
    .map((channel) => channel!.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * That the top and the bottom of the screen are one band, in whichever home is open: the
 * header, the tab bar, the document behind them — which is what an installed app on iOS
 * paints its status bar from, and, laid out under the phone's bars, what reaches the
 * gesture bar at the other end — and the tag a browser and an installed app on Android
 * tint their chrome with. Any of the four could go its own way, and on a phone that
 * shows up as a seam a millimetre above the header or below the tabs.
 */
async function expectOneBand(page: Page, hex: string) {
  await expect(barOf(page)).toHaveAttribute("content", hex);

  const canvas = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(asHex(canvas)).toBe(hex);

  // Every frame that paints anything at all, which is the header and the tab bar — the
  // desktop nav inside the header paints nothing and is left out by the filter rather
  // than by a selector that would have to know which nav is which.
  const { framed, painted } = await page.evaluate(() => ({
    framed: document.querySelector("header") !== null,
    painted: [...document.querySelectorAll("header, nav")]
      .map((node) => getComputedStyle(node).backgroundColor)
      .filter((colour) => colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent"),
  }));

  // The header and the tab bar, on any page inside the app.
  if (framed) expect(painted.length).toBeGreaterThanOrEqual(2);
  for (const colour of painted) {
    // Flat, not frosted: an `rgba(…, 0.85)` here is a band that changes colour as the
    // page scrolls under it, which no system bar can follow.
    expect(colour).not.toMatch(/rgba/);
    expect(asHex(colour)).toBe(hex);
  }
}

test.describe("as a home admin", () => {
  test("picks the colour the whole household is then dressed in", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");

    // Every home starts in the app's own colours.
    await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");

    // A marker that only survives if the document is never torn down, so what follows
    // is the colour arriving in the page that is already open rather than in a new one.
    await page.evaluate(() => {
      (window as unknown as { __alive?: boolean }).__alive = true;
    });

    await page.getByRole("radio", { name: "Ocean" }).check();
    await page.getByRole("button", { name: "Save home" }).click();

    await expect(themeOf(page)).toHaveAttribute("data-theme", "OCEAN");
    // The controls go with the household; the frame does not — the header, the tab bar
    // and the tag the phone reads stay the one band whichever theme is picked.
    await expectOneBand(page, "#e5e7eb");
    expect(
      await page.evaluate(
        () => (window as unknown as { __alive?: boolean }).__alive === true,
      ),
      "the page reloaded, so this says nothing about the tag changing",
    ).toBe(true);
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

  test("puts the household's colour on the controls, where the band used to be", async ({
    page,
    loginAs,
  }) => {
    await dress(HOME_NAME, "PLUM");
    await loginAs(ACCOUNTS.member);
    await page.goto("/lists");

    // The tab that is lit is drawn in --accent, so this is the home's colour reaching
    // the screen — a data-theme nothing reads would look identical from every other test.
    const lit = page.locator("nav a[aria-current='page'] span").first();
    const filled = await lit.evaluate((node) => getComputedStyle(node).backgroundColor);

    expect(asHex(filled)).toBe("#a21caf");
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
    // The controls came with them; the band did not need to, because it was never the
    // home's to begin with.
    await expectOneBand(page, "#e5e7eb");
  });

  /**
   * The tag survives a switch rather than being duplicated by one.
   *
   * Switching home is a client-side navigation, and each one asks the layout to render
   * the tag again. Since the band no longer varies with the household the content never
   * has reason to change, but anything that later wrote the tag from the browser instead
   * of the session — the usual `document.createElement("meta")` recipe — would still
   * leave two of them, and the one the phone reads is whichever came first. The marker on
   * `window` rules out the other way a single, correct tag could happen: a full reload.
   */
  test("keeps a single tag across a switch, without reloading the page", async ({
    page,
    loginAs,
  }) => {
    await alsoJoin(ACCOUNTS.member.email, OTHER_HOME_NAME);
    await dress(HOME_NAME, "PLUM");
    await dress(OTHER_HOME_NAME, "SAND");

    await loginAs(ACCOUNTS.member);
    await expect(barOf(page)).toHaveAttribute("content", "#e5e7eb");

    await page.evaluate(() => {
      (window as unknown as { __alive?: boolean }).__alive = true;
    });

    await openHomeMenu(page);
    await page.getByRole("menuitem", { name: OTHER_HOME_NAME }).click();
    await expect(
      page.getByRole("button", { name: `${OTHER_HOME_NAME} — home menu` }),
    ).toBeVisible();

    await expect(barOf(page)).toHaveAttribute("content", "#e5e7eb");
    expect(await barOf(page).count()).toBe(1);

    const alive = await page.evaluate(
      () => (window as unknown as { __alive?: boolean }).__alive === true,
    );
    expect(alive, "the page reloaded, so this says nothing about the tag surviving").toBe(
      true,
    );
  });
});

test("the login page wears the app's own colours, belonging to no home", async ({ page }) => {
  await dress(HOME_NAME, "PLUM");
  await page.goto("/login");

  await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");
  // The one band, same as every home and the same the manifest carries — what somebody
  // sees before they are in a home at all.
  await expectOneBand(page, "#e5e7eb");
});
