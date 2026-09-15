import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, OTHER_HOME_NAME, prisma } from "./helpers/database";

/**
 * The browser-level counterpart to the tenancy integration tests: a real signed-in
 * account from one home asking for another home's URLs directly.
 */

async function seedOtherHomeContent() {
  const db = prisma();
  const otherHome = await db.home.findFirstOrThrow({ where: { name: OTHER_HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.outsider.email } });

  const list = await db.list.create({
    data: { homeId: otherHome.id, createdById: owner.id, title: "Neighbour's shopping" },
  });
  // The other home keeps its own categories, which is part of what must stay invisible.
  const category = await db.recipeCategory.create({
    data: { homeId: otherHome.id, name: "Neighbour's sauces" },
  });
  const recipe = await db.recipe.create({
    data: {
      homeId: otherHome.id,
      createdById: owner.id,
      categories: { create: { categoryId: category.id } },
      title: "Neighbour's secret sauce",
      ingredients: "Tomatoes",
      instructions: "Simmer.",
    },
  });

  return { list, recipe, otherHome };
}

test.describe("a member of one home", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.member);
  });

  test("cannot open another home's list by its URL", async ({ page }) => {
    const { list } = await seedOtherHomeContent();

    const response = await page.goto(`/lists/${list.id}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Neighbour's shopping")).toBeHidden();
  });

  test("cannot open another home's recipe by its URL", async ({ page }) => {
    const { recipe } = await seedOtherHomeContent();

    const response = await page.goto(`/recipes/${recipe.id}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByText("Neighbour's secret sauce")).toBeHidden();
  });

  test("sees only their own home's lists and recipes", async ({ page }) => {
    await seedOtherHomeContent();

    await page.goto("/lists");
    await expect(page.getByText("Neighbour's shopping")).toBeHidden();

    await page.goto("/recipes");
    await expect(page.getByText("Neighbour's secret sauce")).toBeHidden();
  });

  test("has no admin navigation and is turned away from the admin pages", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/admin/homes");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("an admin of a different home", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.outsider);
  });

  test("administers only their own home", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByText(`Managing ${OTHER_HOME_NAME}`)).toBeVisible();
    await expect(page.getByText(`Managing ${HOME_NAME}`)).toBeHidden();
    await expect(page.getByText(ACCOUNTS.member.email)).toBeHidden();
  });

  test("cannot reach the other home's list even knowing its id", async ({ page }) => {
    const db = prisma();
    const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
    const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.admin.email } });
    const list = await db.list.create({
      data: { homeId: home.id, createdById: owner.id, title: "Private list" },
    });

    const response = await page.goto(`/lists/${list.id}`);

    expect(response?.status()).toBe(404);
  });
});

test.describe("the not-found page", () => {
  test("explains itself and offers a way back", async ({ page, loginAs }) => {
    const { list } = await seedOtherHomeContent();
    await loginAs(ACCOUNTS.member);

    const response = await page.goto(`/lists/${list.id}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the dashboard" })).toBeVisible();
  });

  test("looks the same for a record that never existed", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);

    const response = await page.goto("/lists/does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });
});

test.describe("a super admin", () => {
  test("can open a home's content once switched into it", async ({ page, loginAs }) => {
    const { list, otherHome } = await seedOtherHomeContent();

    await loginAs(ACCOUNTS.superAdmin);
    await prisma().user.update({
      where: { email: ACCOUNTS.superAdmin.email },
      data: { homeId: otherHome.id },
    });

    await page.goto(`/lists/${list.id}`);

    await expect(page.getByRole("heading", { name: "Neighbour's shopping" })).toBeVisible();
  });
});
