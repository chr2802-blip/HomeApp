import { ACCOUNTS, expect, openMenu, test } from "./helpers/fixtures";
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

/**
 * The screen somebody actually sees when an action is asked for another home's record.
 *
 * This is the one case in the app that is *not* a 404: a page for another home's list
 * is simply not found, but an action carrying another home's id throws, and the app
 * shell's error boundary draws "Not your home" instead of the generic crash.
 *
 * It has to be asserted in the browser, against a production build, because that is the
 * only place the bug it guards against ever appeared. The boundary used to decide which
 * screen to draw by reading `error.message`, and Next replaces a server error's message
 * on its way to the client — so this screen worked on a laptop and never once in
 * production, where the household got "Something went wrong. Trying again often clears
 * it" about something that would never work. A unit test could not have caught it and
 * neither could `next dev`.
 *
 * The id is swapped on the form rather than posted by hand, which is what a stale page
 * amounts to: the household member is genuinely signed in, the form is the app's own,
 * and only the record it names is one they may not touch.
 */
test("an action aimed at another home's record says whose it is", async ({ page, loginAs }) => {
  const { list: theirs } = await seedOtherHomeContent();
  await loginAs(ACCOUNTS.member);

  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const mine = await db.list.create({
    data: { homeId: home.id, createdById: owner.id, title: "My own list" },
  });

  await page.goto(`/lists/${mine.id}`);
  await openMenu(page);

  // The confirmation sheet carries a hidden field of its own and is only mounted when it
  // opens, so the swap has to happen after that and not before — aiming at the menu's
  // copy deletes the caller's own list, which is how this test first went wrong.
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();

  // Point the form at the neighbour's list, which is what a page left open across a
  // membership change amounts to on its own.
  await sheet.locator('input[name="listId"]').evaluate((input, id) => {
    (input as HTMLInputElement).value = id;
  }, theirs.id);

  await sheet.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Not your home" })).toBeVisible();
  await expect(page.getByText("Something went wrong")).toBeHidden();

  // And it refused: the neighbour still has their list.
  expect(await db.list.findUnique({ where: { id: theirs.id } })).not.toBeNull();
});

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

    // Nor the home's own settings, which are the admin's rather than every member's.
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("an admin of a different home", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.outsider);
  });

  test("administers only their own home", async ({ page }) => {
    await page.goto("/settings");

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
    // Reading a home, without joining it: what a super admin may reach is not a
    // membership, which is the whole difference between them and everybody else.
    await prisma().user.update({
      where: { email: ACCOUNTS.superAdmin.email },
      data: { activeHomeId: otherHome.id },
    });

    await page.goto(`/lists/${list.id}`);

    await expect(page.getByRole("heading", { name: "Neighbour's shopping" })).toBeVisible();
  });
});
