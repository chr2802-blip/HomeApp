import { ACCOUNTS, expect, rowWith, test } from "./helpers/fixtures";
import { HOME_NAME, OTHER_HOME_NAME, prisma } from "./helpers/database";

test.describe("as a home admin", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/admin");
  });

  test("the home's details can be edited", async ({ page }) => {
    await expect(page.getByText(`Managing ${HOME_NAME}`)).toBeVisible();

    await page.getByLabel("Home name").fill("The Nest");
    await page.getByLabel("Address (optional)").fill("9 New Road");
    await page.getByRole("button", { name: "Save home" }).click();

    await expect(page.getByText("Managing The Nest")).toBeVisible();
    await expect(page.getByLabel("Address (optional)")).toHaveValue("9 New Road");
  });

  test("members are listed with the admin marked as you", async ({ page }) => {
    await expect(page.getByText(`${ACCOUNTS.admin.name} (you)`)).toBeVisible();
    await expect(page.getByText(ACCOUNTS.member.email)).toBeVisible();
    // Nobody from the other home leaks in.
    await expect(page.getByText(ACCOUNTS.outsider.email)).toBeHidden();
  });

  test("a member can be promoted to admin", async ({ page }) => {
    const memberRow = rowWith(page, ACCOUNTS.member.email, page.getByRole("combobox"));
    await memberRow.getByRole("combobox").selectOption("ADMIN");
    await memberRow.getByRole("button", { name: "Save" }).click();

    await expect(async () => {
      const updated = await prisma().user.findUnique({ where: { email: ACCOUNTS.member.email } });
      expect(updated?.role).toBe("ADMIN");
    }).toPass();
  });

  test("a member can be removed", async ({ page }) => {
    const memberRow = rowWith(page, ACCOUNTS.member.email, page.getByRole("button", { name: "Remove" }));
    await memberRow.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText(ACCOUNTS.member.email)).toBeHidden();
    expect(await prisma().user.findUnique({ where: { email: ACCOUNTS.member.email } })).toBeNull();
  });

  test("an admin has no role or remove control on their own row", async ({ page }) => {
    // The member's row carries both controls, so their absence below is meaningful
    // rather than a selector that simply found nothing.
    const memberRow = rowWith(page, ACCOUNTS.member.email, page.getByRole("combobox"));
    await expect(memberRow.getByRole("combobox")).toHaveCount(1);
    await expect(memberRow.getByRole("button", { name: "Remove" })).toHaveCount(1);

    const ownRow = rowWith(page, `${ACCOUNTS.admin.name} (you)`, page.getByText(ACCOUNTS.admin.email));
    await expect(ownRow.getByRole("combobox")).toHaveCount(0);
    await expect(ownRow.getByRole("button", { name: "Remove" })).toHaveCount(0);
  });

  test("an invite can be issued and then revoked", async ({ page }) => {
    await page.getByLabel("Email to invite").fill("guest@e2e.test");
    await page.getByLabel("Role").selectOption("ADMIN");
    await page.getByRole("button", { name: "Create invite" }).click();

    await expect(page.getByText("Invitation ready for guest@e2e.test")).toBeVisible();
    await expect(page.getByText("guest@e2e.test", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Revoke" }).click();

    await expect(page.getByText("admin · expires")).toBeHidden();
    expect(await prisma().invite.count()).toBe(0);
  });

  test("inviting an address that already has an account is refused", async ({ page }) => {
    await page.getByLabel("Email to invite").fill(ACCOUNTS.member.email);
    await page.getByRole("button", { name: "Create invite" }).click();

    await expect(page.getByText("That email already has an account.")).toBeVisible();
  });

  test("the admin can change their own name", async ({ page }) => {
    // exact, or this also matches the "Home name" field.
    await page.getByLabel("Name", { exact: true }).fill("Ada Renamed");
    await page.getByRole("button", { name: "Update account" }).click();

    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Ada Renamed");
    await expect(page.getByText("Ada Renamed (you)")).toBeVisible();
  });

  test("a home admin sees no link to all homes", async ({ page }) => {
    await expect(page.getByRole("link", { name: "All homes" })).toHaveCount(0);
  });

  test("a home admin cannot reach the homes page", async ({ page }) => {
    await page.goto("/admin/homes");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("as a super admin", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.superAdmin);
  });

  test("with no home selected, the admin page asks for one", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Select a home first.")).toBeVisible();
  });

  test("every home is listed with its contents counted", async ({ page }) => {
    await page.goto("/admin/homes");

    await expect(page.getByText(HOME_NAME)).toBeVisible();
    await expect(page.getByText(OTHER_HOME_NAME)).toBeVisible();
    await expect(page.getByText("2 members · 0 lists · 0 tasks · 0 recipes")).toBeVisible();
  });

  test("a new home can be created", async ({ page }) => {
    await page.goto("/admin/homes");

    await page.getByLabel("New home name").fill("Summer House");
    await page.getByLabel("Address (optional)").fill("7 Beach Lane");
    await page.getByRole("button", { name: "Create home" }).click();

    await expect(page.getByText("Summer House")).toBeVisible();
    await expect(page.getByText("7 Beach Lane")).toBeVisible();
  });

  test("switching into a home makes it the active one", async ({ page }) => {
    await page.goto("/admin/homes");

    const otherRow = rowWith(page, OTHER_HOME_NAME, page.getByRole("button", { name: "Switch to" }));
    await otherRow.getByRole("button", { name: "Switch to" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/admin");
    await expect(page.getByText(`Managing ${OTHER_HOME_NAME}`)).toBeVisible();
  });

  test("deleting a home takes its members and content with it", async ({ page }) => {
    await page.goto("/admin/homes");

    const targetRow = rowWith(page, HOME_NAME, page.getByRole("button", { name: "Delete" }));
    await targetRow.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(HOME_NAME)).toBeHidden();
    expect(await prisma().user.findUnique({ where: { email: ACCOUNTS.member.email } })).toBeNull();
    // The other home is untouched.
    expect(await prisma().home.count()).toBe(1);
  });
});
