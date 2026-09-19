import { ACCOUNTS, expect, logInThroughForm, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";

test.describe("signing in", () => {
  test("a member logs in and lands on the dashboard", async ({ page }) => {
    // The one test that is about the form itself, so it fills it in rather than
    // starting from a session the way every other spec does.
    await logInThroughForm(page, ACCOUNTS.member);

    await expect(page).toHaveURL(/\/dashboard$/);
    // The home's name in the header, which is also the menu holding their profile.
    await expect(page.getByRole("button", { name: `${HOME_NAME} — home menu` })).toBeVisible();
    await expect(page.getByText(ACCOUNTS.member.name)).toBeVisible();
  });

  test("a wrong password is refused and the session stays out", async ({ page }) => {
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

  test("logging out ends the session", async ({ page, loginAs }) => {
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

test.describe("accepting an invite", () => {
  test("an admin issues a code and the invitee signs up with it", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");

    await page.getByLabel("Email to invite").fill("newcomer@e2e.test");
    await page.getByRole("button", { name: "Create invite" }).click();

    await expect(page.getByText("Invitation ready for newcomer@e2e.test")).toBeVisible();
    const code = (await page.locator("p.font-mono").innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // The invitee arrives as a fresh visitor: nobody signed in, and no account yet.
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/login$/);

    await page.goto("/accept-invite");
    await page.getByLabel("Invited email").fill("newcomer@e2e.test");
    await page.getByLabel("Invitation code").fill(code);
    await page.getByLabel("Your name").fill("Nina Newcomer");
    await page.getByLabel("Choose a password").fill("a-good-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Nina Newcomer")).toBeVisible();

    const created = await prisma().user.findUnique({ where: { email: "newcomer@e2e.test" } });
    expect(created?.role).toBe("USER");
  });

  test("a wrong code is refused and no account appears", async ({ page }) => {
    await page.goto("/accept-invite");
    await page.getByLabel("Invited email").fill("newcomer@e2e.test");
    await page.getByLabel("Invitation code").fill("AAAA-BBBB");
    await page.getByLabel("Your name").fill("Nina Newcomer");
    await page.getByLabel("Choose a password").fill("a-good-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("That email and code don't match an open invitation.")).toBeVisible();
    expect(await prisma().user.findUnique({ where: { email: "newcomer@e2e.test" } })).toBeNull();
  });
});
