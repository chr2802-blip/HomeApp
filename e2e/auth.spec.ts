import { ACCOUNTS, expect, logInThroughForm, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";

test.describe("signing in", () => {
  test("a member logs in and lands on the dashboard", { tag: "@smoke" }, async ({ page }) => {
    // The one test that is about the form itself, so it fills it in rather than
    // starting from a session the way every other spec does.
    await logInThroughForm(page, ACCOUNTS.member);

    await expect(page).toHaveURL(/\/dashboard$/);
    // The home's name in the header, which is also the menu holding their profile.
    await expect(page.getByRole("button", { name: `${HOME_NAME} — home menu` })).toBeVisible();
    await expect(page.getByText(ACCOUNTS.member.name)).toBeVisible();
  });

  test("a wrong password is refused and the session stays out", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ACCOUNTS.member.email);
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Wrong email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // The session really is absent, not just unrendered.
    await page.goto("/lists");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an unknown email gets the same message, revealing nothing", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@e2e.test");
    await page.getByLabel("Password").fill(ACCOUNTS.member.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Wrong email or password.")).toBeVisible();
  });

  test("logging out ends the session", { tag: "@smoke" }, async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("pages that need a session", () => {
  for (const path of ["/dashboard", "/lists", "/tasks", "/meals", "/recipes", "/admin", "/settings", "/profile"]) {
    test(`${path} redirects a signed-out visitor to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});

test.describe("joining with an invitation link", () => {
  test("an admin makes a link and a newcomer signs up through it", { tag: "@smoke" }, async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings/members");
    await page.getByRole("button", { name: "Make invitation link" }).click();
    // The field starts as the bare path and gains the browser's origin once mounted.
    const field = page.getByLabel("Invitation link", { exact: true });
    await expect(field).toHaveValue(/^https?:\/\/.+\/join\/[A-Za-z0-9_-]{43}$/);
    const url = await field.inputValue();

    // The newcomer arrives as a fresh visitor: nobody signed in, and no account yet.
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/login$/);

    await page.goto(new URL(url).pathname);
    await expect(page.getByRole("heading", { name: `Join ${HOME_NAME}` })).toBeVisible();
    await page.getByLabel("Your name").fill("Nina Newcomer");
    await page.getByLabel("Email").fill("newcomer@e2e.test");
    await page.getByLabel("Password").fill("a-good-password");
    await page.getByRole("button", { name: "Create me and join" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Nina Newcomer")).toBeVisible();

    const created = await prisma().user.findUnique({
      where: { email: "newcomer@e2e.test" },
      include: { memberships: true },
    });
    expect(created?.memberships.map((m) => m.role)).toEqual(["USER"]);
  });

  test("a link that does not work says so and offers no form", async ({ page }) => {
    await page.goto("/join/not-a-real-link");

    await expect(page.getByText("This link does not work.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
  });
});

