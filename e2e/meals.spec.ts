import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";
import { formatDayInZone, nextWeekStart, todayInZone, weekDays, weekStartInZone } from "../src/lib/time";

async function seedRecipe(title: string) {
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
      title,
      ingredients: "Something",
      instructions: "Cook it.",
      categories: { create: [{ categoryId: category.id }] },
    },
  });
}

/** The plan rows are named by their weekday, which is how a person finds one. */
function day(page: Parameters<typeof plan>[0], date: string) {
  return page.getByRole("button", { name: new RegExp(`^${formatDayInZone(date, "EEEE")}`) });
}

async function plan(page: import("@playwright/test").Page, date: string, choice: string) {
  await day(page, date).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Eating").selectOption({ label: choice });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/meals");
});

test("the week starts as seven days with nothing planned", async ({ page }) => {
  for (const date of weekDays(weekStartInZone())) {
    await expect(day(page, date)).toBeVisible();
  }

  await expect(page.getByText("Nothing planned")).toHaveCount(7);
  // Today is the row somebody opening this page is looking for, so it says so.
  await expect(page.getByText("Today", { exact: true })).toBeVisible();
});

test("a recipe can be planned for a day, and shows on that day", async ({ page }) => {
  await seedRecipe("Pancakes");
  await page.reload();

  const today = todayInZone();
  await plan(page, today, "Pancakes");

  await expect(day(page, today)).toContainText("Pancakes");
  await expect(page.getByText("Nothing planned")).toHaveCount(6);
});

test("a day can be marked as eating out, and taken back to nothing", async ({ page }) => {
  const today = todayInZone();

  await plan(page, today, "Eating out");
  await expect(day(page, today)).toContainText("Eating out");

  await plan(page, today, "Nothing planned");
  await expect(page.getByText("Nothing planned")).toHaveCount(7);
});

test("replanning a day replaces what was there rather than adding to it", async ({ page }) => {
  await seedRecipe("Pancakes");
  await seedRecipe("Lasagne");
  await page.reload();

  const today = todayInZone();
  await plan(page, today, "Pancakes");
  await plan(page, today, "Lasagne");

  await expect(day(page, today)).toContainText("Lasagne");
  await expect(day(page, today)).not.toContainText("Pancakes");
});

test("the week's plan is kept, and the weeks either side are their own", async ({ page }) => {
  await seedRecipe("Pancakes");
  await page.reload();

  const today = todayInZone();
  await plan(page, today, "Pancakes");

  await page.getByRole("link", { name: "Next week" }).click();
  // A different week: nothing planned in it, and a way back to the live one.
  await expect(page.getByText("Nothing planned")).toHaveCount(7);
  await expect(page.getByRole("link", { name: "Back to this week" })).toBeVisible();

  await page.getByRole("link", { name: "Back to this week" }).click();
  await expect(day(page, today)).toContainText("Pancakes");
});

test("a week reached by its own address is the week it names", async ({ page }) => {
  const week = nextWeekStart(weekStartInZone());

  // Any day of a week is a link to that week: the address is normalised to its Monday.
  await page.goto(`/meals?week=${weekDays(week)[3]}`);

  for (const date of weekDays(week)) {
    await expect(day(page, date)).toBeVisible();
  }
  await expect(page.getByText("Today", { exact: true })).toHaveCount(0);
});

test("an address naming a day that never existed falls back to this week", async ({ page }) => {
  await page.goto("/meals?week=2026-02-31");

  await expect(page.getByText("Today", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to this week" })).toHaveCount(0);
});

test("the tab is in the bar, and leads here", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Meals" }).first().click();

  await expect(page).toHaveURL(/\/meals$/);
  await expect(page.getByRole("heading", { name: "Meals" })).toBeVisible();
});
