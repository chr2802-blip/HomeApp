import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/**
 * The AI wait is drawn for a save the AI will actually read, and for nothing else.
 *
 * `needsReading` is asked twice — by the form, before it draws the wait, and by the save,
 * before it calls the reader (as `readingStands`) — and these hold the browser's half: a
 * save that left the ingredients and steps alone shows no wait at all, while one that did shows it. The save
 * is held at the network until the assertion is made, so what is on screen is what is
 * shown *while* it is pending, not after.
 */

/** A recipe whose text was already read into the one format (`IN_FORMAT`). */
async function seedRead() {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const category = await db.recipeCategory.findFirstOrThrow({
    where: { homeId: home.id, name: CATEGORIES[0] },
  });

  return db.recipe.create({
    data: {
      homeId: home.id,
      createdById: owner.id,
      title: "Roast potatoes",
      ingredients: "500 g potatoes\n2 tbsp oil\nSalt",
      instructions: "Cut the potatoes.\nToss in oil.\nRoast.",
      cookSteps: { v: 2, steps: [{ uses: [0] }, { uses: [1, 2] }, { uses: [], minutes: 40 }] },
      categories: { create: [{ categoryId: category.id }] },
    },
  });
}

/** Holds the save's request until `release` is called, and says when it has been sent. */
async function holdSave(page: Page, path: string) {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let sent = () => {};
  const arrived = new Promise<void>((resolve) => (sent = resolve));

  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent();
    await held;
    await route.continue();
  });

  return { arrived, release: () => release() };
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("an edit that changes nothing the AI reads saves without the AI wait", async ({ page }) => {
  const recipe = await seedRead();
  await page.goto(`/recipes/${recipe.id}/edit`);
  const save = await holdSave(page, `/recipes/${recipe.id}/edit`);

  await page.getByLabel("Total time (minutes)").fill("45");
  await page.getByRole("button", { name: "Save changes" }).click();
  await save.arrived;

  await expect(page.getByTestId("ai-overlay")).toHaveCount(0);
  save.release();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
});

test("an edit to the ingredients shows the AI wait while it is read", async ({ page }) => {
  const recipe = await seedRead();
  await page.goto(`/recipes/${recipe.id}/edit`);
  const save = await holdSave(page, `/recipes/${recipe.id}/edit`);

  await page.getByLabel("Ingredients").fill("600 g potatoes\n2 tbsp oil\nSalt");
  await page.getByRole("button", { name: "Save changes" }).click();
  await save.arrived;

  await expect(page.getByTestId("ai-overlay")).toBeVisible();
  save.release();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
});
