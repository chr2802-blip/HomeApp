import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";
import { formatDayInZone, nextWeekStart, todayInZone, weekDays, weekStartInZone } from "../src/lib/time";

async function seedRecipe(title: string, ingredients = "Something") {
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
      ingredients,
      instructions: "Cook it.",
      categories: { create: [{ categoryId: category.id }] },
    },
  });
}

/** The plan rows are named by their weekday, which is how a person finds one. */
function day(page: Parameters<typeof plan>[0], date: string) {
  return page.getByRole("button", { name: new RegExp(`^${formatDayInZone(date, "EEEE")}`) });
}

/**
 * Opens a day's sheet, and waits for the trigger to say it can actually open it.
 *
 * Hydration leaves no mark of its own — the markup is identical before and after React
 * attaches — so the wait is on `data-ready`, which the button grows once its handler is
 * on it. Clicking before that is a press into a static page, which passes here and fails
 * whenever the machine is busy.
 */
async function openDay(page: import("@playwright/test").Page, date: string) {
  const row = day(page, date);
  await expect(row).toHaveAttribute("data-ready", "true");
  await row.click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** One choice in the sheet, which is a radio row rather than an option in a list. */
function choice(page: import("@playwright/test").Page, name: string | RegExp) {
  return page.getByRole("radio", { name });
}

async function plan(page: import("@playwright/test").Page, date: string, name: string) {
  await openDay(page, date);
  await choice(page, name).check();
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

test("a day can live off an earlier one's cooking, and says whose", async ({ page }) => {
  const [monday, tuesday] = weekDays(weekStartInZone());
  await seedRecipe("Pancakes");
  await page.reload();

  await plan(page, monday!, "Pancakes");
  await plan(page, tuesday!, "Leftovers — Monday's Pancakes");

  // The row names the meal and the day it was cooked: "Leftovers" alone says no dinner.
  await expect(day(page, tuesday!)).toContainText("Leftovers — Monday's Pancakes");
  await expect(day(page, monday!)).toContainText("Pancakes");
});

test("only the days already cooked are offered to be the leftovers of", async ({ page }) => {
  const [monday, tuesday, wednesday] = weekDays(weekStartInZone());
  await seedRecipe("Pancakes");
  await page.reload();

  await plan(page, tuesday!, "Pancakes");

  // Monday comes before the cooking, so it is offered nothing to live off; Wednesday
  // comes after it and is. An option the action would only refuse is not offered at all.
  await openDay(page, monday!);
  await expect(choice(page, /Leftovers/)).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await openDay(page, wednesday!);
  await expect(choice(page, "Leftovers — Tuesday's Pancakes")).toHaveCount(1);
});

test("an empty day is offered what shares most with the week, and fills the picker in", async ({
  page,
}) => {
  const [monday, tuesday] = weekDays(weekStartInZone());
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Beef stew", "Beef\nOnion\nCarrot");
  await seedRecipe("Cod and saffron", "Cod\nSaffron\nCream");
  await page.reload();

  await plan(page, monday!, "Beef pasta");

  await openDay(page, tuesday!);

  // The stew shares two of its three with Monday, so it is named under Suggested with
  // its reason; the cod shares nothing and is offered only as an ordinary recipe.
  await expect(page.getByText("Suggested")).toBeVisible();
  const suggested = choice(page, /Beef stew/);
  await expect(suggested).toHaveCount(1);
  await expect(suggested).toHaveAccessibleName(/Shares 2 of 3 ingredients with the week/);
  await expect(choice(page, /Cod and saffron/)).toHaveAccessibleName(/^Cod and saffron$/);

  // Choosing it fills the form in and stops there — the household still presses Save.
  await suggested.check();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(day(page, tuesday!)).toContainText("Beef stew");
});

test("a day with nothing to compare against is offered nothing", async ({ page }) => {
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await page.reload();

  // Nothing planned anywhere, so there is no basket to share with — and "best" would
  // only mean "shortest", which is a ranking of recipes by how little they are.
  await openDay(page, weekDays(weekStartInZone())[0]!);
  await expect(page.getByText("Suggested")).toHaveCount(0);
  // The recipe is still there to be chosen, under the heading that claims everything.
  await expect(choice(page, "Beef pasta")).toHaveCount(1);
});

test("the picker searches by name and by ingredient", async ({ page }) => {
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Cod and saffron", "Cod\nSaffron\nCream");
  await page.reload();

  await openDay(page, weekDays(weekStartInZone())[0]!);
  const search = page.getByRole("searchbox", { name: "Search recipes" });

  await search.fill("cod");
  await expect(choice(page, "Cod and saffron")).toHaveCount(1);
  await expect(choice(page, "Beef pasta")).toHaveCount(0);

  // A cook's question is more often "what can I do with the saffron" than "what was
  // that called", so the ingredients are searched as well as the titles.
  await search.fill("onion");
  await expect(choice(page, "Beef pasta")).toHaveCount(1);
  await expect(choice(page, "Cod and saffron")).toHaveCount(0);

  await search.fill("nothing like this");
  await expect(page.getByText(/Nothing here matches/)).toBeVisible();
});

test("searching never takes away the choice already made", async ({ page }) => {
  // A radio that leaves the page takes its value out of the form with it, and a plan
  // field that arrives empty means "nothing planned" — which deletes the day. Typing in
  // the search box is not a way to clear an evening.
  const monday = weekDays(weekStartInZone())[0]!;
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Cod and saffron", "Cod\nSaffron\nCream");
  await page.reload();

  await plan(page, monday, "Beef pasta");

  await openDay(page, monday);
  await page.getByRole("searchbox", { name: "Search recipes" }).fill("cod");
  await expect(choice(page, "Beef pasta")).toBeChecked();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(day(page, monday)).toContainText("Beef pasta");
});

test("a recipe is offered once, under the first group that claims it", async ({ page }) => {
  const [monday, tuesday] = weekDays(weekStartInZone());
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Beef stew", "Beef\nOnion\nCarrot");
  await page.reload();

  await plan(page, monday!, "Beef pasta");

  // The stew is suggested, so it is not drawn again under "All recipes": one lasagne in
  // two places reads as the sheet having lost count, not as two reasons to cook it.
  await openDay(page, tuesday!);
  await expect(choice(page, /Beef stew/)).toHaveCount(1);
});
