import { ACCOUNTS, expect, test } from "./helpers/fixtures";
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

/** Dresses a home directly, standing in for an admin who has already been to /admin. */
function dress(homeName: string, theme: "OCEAN" | "PLUM" | "SAND") {
  return prisma().home.updateMany({ where: { name: homeName }, data: { theme } });
}

const themeOf = (page: Page) => page.locator("html");

test.describe("as a home admin", () => {
  test("picks the colour the whole household is then dressed in", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/admin");

    // Every home starts in the app's own colours.
    await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");

    await page.getByRole("radio", { name: "Ocean" }).check();
    await page.getByRole("button", { name: "Save home" }).click();

    await expect(themeOf(page)).toHaveAttribute("data-theme", "OCEAN");
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

    const trigger = page.getByRole("button", { name: /switch home$/ });
    // Hydration has no signal of its own; the trigger grows one when it is ready.
    await expect(trigger).toHaveAttribute("data-ready", "true");
    await trigger.click();
    await page.getByRole("menuitem", { name: OTHER_HOME_NAME }).click();

    await expect(
      page.getByRole("button", { name: `${OTHER_HOME_NAME} — switch home` }),
    ).toBeVisible();
    await expect(themeOf(page)).toHaveAttribute("data-theme", "SAND");
  });
});

test("the login page wears the app's own colours, belonging to no home", async ({ page }) => {
  await dress(HOME_NAME, "PLUM");
  await page.goto("/login");

  await expect(themeOf(page)).toHaveAttribute("data-theme", "SLATE");
});
