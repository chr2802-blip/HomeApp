import { ACCOUNTS, expect, openHomeMenu, test } from "./helpers/fixtures";
import { HOME_NAME, OTHER_HOME_NAME, prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/**
 * Being in more than one home, through the browser: the header says which one is on
 * screen and is the way to the others, and what each household holds stays its own
 * across the move.
 */

/** Puts a seeded account into a second home, which the fixed cast does not start with. */
async function alsoJoin(email: string, homeName: string, role: "ADMIN" | "USER" = "USER") {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: homeName } });
  const user = await db.user.findFirstOrThrow({ where: { email } });
  await db.homeMember.create({ data: { userId: user.id, homeId: home.id, role } });
  return home;
}

/**
 * Moves to a home through the header's menu, and waits until the header says so — the
 * switch is a form submission, so the next page is not there the moment it is clicked.
 */
async function switchTo(page: Page, homeName: string) {
  await openHomeMenu(page);

  await page.getByRole("menuitem", { name: homeName }).click();
  await expect(page.getByRole("button", { name: `${homeName} — home menu` })).toBeVisible();
}

test.describe("somebody in one home", () => {
  test("is offered no other home in the menu, because there is none to go to", async ({
    page,
    loginAs,
  }) => {
    await loginAs(ACCOUNTS.member);
    await openHomeMenu(page);

    // The menu is still there — it holds their profile — but a chooser with a single
    // choice is furniture, so the home they are in is not listed as somewhere to go.
    await expect(page.getByRole("menuitem", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: HOME_NAME })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: OTHER_HOME_NAME })).toHaveCount(0);
  });

  test("still reaches the list of their homes", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);
    await page.goto("/homes");

    // Scoped to the page itself: the header names the home too.
    const listed = page.getByRole("main");
    await expect(listed.getByText(HOME_NAME)).toBeVisible();
    await expect(listed.getByText(OTHER_HOME_NAME)).toBeHidden();
  });
});

test.describe("somebody in two homes", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await alsoJoin(ACCOUNTS.member.email, OTHER_HOME_NAME);
    await loginAs(ACCOUNTS.member);
    await page.goto("/dashboard");
  });

  test("moves between them from the header", async ({ page }) => {
    await switchTo(page, OTHER_HOME_NAME);
    await expect(page).toHaveURL(/\/dashboard$/);

    await switchTo(page, HOME_NAME);
  });

  test("sees each household's lists only while they are in it", async ({ page }) => {
    const other = await prisma().home.findFirstOrThrow({ where: { name: OTHER_HOME_NAME } });
    const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.outsider.email } });
    await prisma().list.create({
      data: { homeId: other.id, createdById: owner.id, title: "Holiday shopping" },
    });

    await page.goto("/lists");
    await expect(page.getByText("Holiday shopping")).toBeHidden();

    await switchTo(page, OTHER_HOME_NAME);
    await page.goto("/lists");

    await expect(page.getByText("Holiday shopping")).toBeVisible();
  });

  test("finds both on the homes page, with the one on screen marked", async ({ page }) => {
    await page.goto("/homes");

    const listed = page.getByRole("main");
    await expect(listed.getByText(HOME_NAME)).toBeVisible();
    await expect(listed.getByText(OTHER_HOME_NAME)).toBeVisible();
    await expect(listed.getByText("Active")).toBeVisible();

    await page.getByRole("button", { name: "Switch to" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByRole("button", { name: `${OTHER_HOME_NAME} — home menu` }),
    ).toBeVisible();
  });
});

test.describe("joining a second home", () => {
  test("an existing account redeems the code without making another", async ({
    page,
    loginAs,
  }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");
    await page.getByLabel("Email to invite").fill(ACCOUNTS.outsider.email);
    await page.getByRole("button", { name: "Create invite" }).click();
    await expect(page.getByText(`Invitation ready for ${ACCOUNTS.outsider.email}`)).toBeVisible();
    const code = (await page.locator("p.font-mono").innerText()).trim();

    const accountsBefore = await prisma().user.count();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/login$/);
    await loginAs(ACCOUNTS.outsider);

    // Signed in already, so the page asks them to join rather than to sign up.
    await page.goto("/accept-invite");
    await expect(page.getByLabel("Invited email")).toHaveValue(ACCOUNTS.outsider.email);
    await page.getByLabel("Invitation code").fill(code);
    await page.getByLabel("Your password").fill(ACCOUNTS.outsider.password);
    await page.getByRole("button", { name: "Join home" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("button", { name: `${HOME_NAME} — home menu` })).toBeVisible();

    await page.goto("/homes");
    const listed = page.getByRole("main");
    await expect(listed.getByText(HOME_NAME)).toBeVisible();
    await expect(listed.getByText(OTHER_HOME_NAME)).toBeVisible();
    expect(await prisma().user.count()).toBe(accountsBefore);
  });
});

test.describe("an admin of one home and a member of another", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    // A plain member of the first home, who runs the second.
    await alsoJoin(ACCOUNTS.member.email, OTHER_HOME_NAME, "ADMIN");
    await loginAs(ACCOUNTS.member);
    await page.goto("/dashboard");
  });

  test("administers only the home they run", async ({ page }) => {
    // Running one household is no licence over the next, so Settings follows the home
    // on screen rather than the person.
    await openHomeMenu(page);
    await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveCount(0);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/dashboard$/);

    await switchTo(page, OTHER_HOME_NAME);

    await openHomeMenu(page);
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page.getByText(`Managing ${OTHER_HOME_NAME}`)).toBeVisible();
  });
});
