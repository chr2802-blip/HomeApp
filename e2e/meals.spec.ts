import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";
import {
  formatDayInZone,
  nextWeekStart,
  previousWeekStart,
  todayInZone,
  weekDays,
  weekStartInZone,
} from "../src/lib/time";

async function seedRecipe(title: string, ingredients = "Something") {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const category = await db.recipeCategory.findFirstOrThrow({
    where: { homeId: home.id, name: CATEGORIES[0] },
  });

  // Written before the recipe is, not after: `tonightsDinner` auto-picks a recipe for
  // today's own row the moment one becomes eligible, and the app's nav bar prefetches
  // the dashboard the instant its link is on screen — so the window between a home
  // gaining its first recipe and a test's own next move is exactly when an unasked-for
  // plan for today could land. A row already there — eating out, same as an untouched
  // today reads everywhere else in this file — closes that window before it opens:
  // every test below still writes today's own plan explicitly wherever it means to.
  await db.mealPlan.upsert({
    where: { homeId_date: { homeId: home.id, date: todayInZone() } },
    create: { homeId: home.id, date: todayInZone() },
    update: {},
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
 * A day's whole row, button and "Go to recipe" link both — the immediate parent the two
 * sit in as siblings, since a button cannot hold a link. Scoping to it is what tells one
 * day's "Go to recipe" apart from another's.
 */
function dayRow(page: Parameters<typeof plan>[0], date: string) {
  return day(page, date).locator("xpath=..");
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

async function newList(page: import("@playwright/test").Page, title: string) {
  await page.goto("/lists");
  await openDialog(page, "New list");
  await page.getByLabel("List name").fill(title);
  await page.getByLabel("Track amounts").check();
  await page.getByRole("button", { name: "Create list" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);
}

/**
 * Opens the meals page's "Add to list" menu and chooses one — the same menu a recipe's
 * own page offers, waited on the same way: hydration leaves no mark of its own, so a
 * press before React has attached looks exactly like a miss.
 */
async function addToList(page: import("@playwright/test").Page, listTitle: string) {
  const trigger = page.getByRole("button", { name: "Add to list" });
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await page.getByRole("menuitem", { name: new RegExp(`^${listTitle}`) }).click();
  await expect(page.getByText(`Added to ${listTitle}.`)).toBeVisible();
}

/**
 * A week guaranteed to hold no day in the past, whatever weekday a test happens to run
 * on: the live week's own earlier days go from "still to plan" to "already lived
 * through" as the week goes by, which every test below that needs more than one day to
 * work with has to be immune to.
 */
const FUTURE_WEEK = nextWeekStart(weekStartInZone());

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

test("a day cooking a recipe offers a way to its own page, on the row itself", async ({
  page,
}) => {
  const recipe = await seedRecipe("Pancakes");
  await page.reload();

  const today = todayInZone();
  const link = dayRow(page, today).getByRole("link", { name: "Go to recipe" });

  // Nothing planned yet, so there is no recipe to go to.
  await expect(link).toHaveCount(0);

  await plan(page, today, "Pancakes");

  await expect(link).toHaveAttribute("href", `/recipes/${recipe.id}`);
  await link.click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
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
  const [monday, tuesday] = weekDays(FUTURE_WEEK);
  await seedRecipe("Pancakes");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);

  await plan(page, monday!, "Pancakes");
  // Cooking a recipe is what earns the row its own "Go to recipe".
  await expect(
    dayRow(page, monday!).getByRole("link", { name: "Go to recipe" }),
  ).toBeVisible();

  await plan(page, tuesday!, "Leftovers — Monday's Pancakes");
  // Leftovers is a choice, but not a recipe with a page of its own — the meal it names
  // already has that row, on the day it was actually cooked.
  await expect(
    dayRow(page, tuesday!).getByRole("link", { name: "Go to recipe" }),
  ).toHaveCount(0);

  // The row names the meal and the day it was cooked: "Leftovers" alone says no dinner.
  await expect(day(page, tuesday!)).toContainText("Leftovers — Monday's Pancakes");
  await expect(day(page, monday!)).toContainText("Pancakes");
});

test("only the days already cooked are offered to be the leftovers of", async ({ page }) => {
  const [monday, tuesday, wednesday] = weekDays(FUTURE_WEEK);
  await seedRecipe("Pancakes");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);

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
  const [monday, tuesday] = weekDays(FUTURE_WEEK);
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Beef stew", "Beef\nOnion\nCarrot");
  await seedRecipe("Cod and saffron", "Cod\nSaffron\nCream");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);

  await plan(page, monday!, "Beef pasta");

  // The dialog closing only says the save resolved, not that this row's own refreshed
  // data has been committed — Tuesday's suggestions are computed from the same render
  // pass as Monday's face, so waiting for Monday to say "Beef pasta" is what makes sure
  // Tuesday is not still holding the groups computed before Monday had a plan at all.
  await expect(day(page, monday!)).toContainText("Beef pasta");

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
  await openDay(page, todayInZone());
  await expect(page.getByText("Suggested")).toHaveCount(0);
  // The recipe is still there to be chosen, under the heading that claims everything.
  await expect(choice(page, "Beef pasta")).toHaveCount(1);
});

test("the picker searches by name and by ingredient", async ({ page }) => {
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Cod and saffron", "Cod\nSaffron\nCream");
  await page.reload();

  await openDay(page, todayInZone());
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
  const today = todayInZone();
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Cod and saffron", "Cod\nSaffron\nCream");
  await page.reload();

  await plan(page, today, "Beef pasta");

  await openDay(page, today);
  await page.getByRole("searchbox", { name: "Search recipes" }).fill("cod");
  await expect(choice(page, "Beef pasta")).toBeChecked();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(day(page, today)).toContainText("Beef pasta");
});

test("a recipe is offered once, under the first group that claims it", async ({ page }) => {
  const [monday, tuesday] = weekDays(FUTURE_WEEK);
  await seedRecipe("Beef pasta", "Beef\nPasta\nOnion");
  await seedRecipe("Beef stew", "Beef\nOnion\nCarrot");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);

  await plan(page, monday!, "Beef pasta");

  // The stew is suggested, so it is not drawn again under "All recipes": one lasagne in
  // two places reads as the sheet having lost count, not as two reasons to cook it.
  await openDay(page, tuesday!);
  await expect(choice(page, /Beef stew/)).toHaveCount(1);
});

test("every recipe planned this week goes onto a chosen list in one press", async ({ page }) => {
  const [monday, tuesday] = weekDays(FUTURE_WEEK);
  await seedRecipe("Pancakes", "Milk\nFlour");
  await seedRecipe("Curry", "Rice\nMilk");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);

  await plan(page, monday!, "Pancakes");
  await plan(page, tuesday!, "Curry");

  await newList(page, "Weekly shop");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);
  await addToList(page, "Weekly shop");

  await page.goto("/lists");
  await page.getByRole("link", { name: /Weekly shop/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  for (const item of ["Milk", "Flour", "Rice"]) {
    await expect(page.getByText(item, { exact: true })).toBeVisible();
  }
});

test("a day already lived through cannot be opened", async ({ page }) => {
  // Every day of the week before this one is strictly earlier than today, whatever day
  // of its own week today happens to be.
  const lastWeek = previousWeekStart(weekStartInZone());
  await page.goto(`/meals?week=${lastWeek}`);

  const row = day(page, weekDays(lastWeek)[0]!);
  await expect(row).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("swiping saves the day being left and moves the sheet on to the next one", async ({
  page,
}) => {
  const [monday, tuesday] = weekDays(FUTURE_WEEK);
  await seedRecipe("Pancakes");
  await seedRecipe("Curry");
  await page.goto(`/meals?week=${FUTURE_WEEK}`);

  await openDay(page, monday!);
  await choice(page, "Pancakes").check();

  const dialog = page.getByRole("dialog");
  const box = (await dialog.boundingBox())!;
  const y = box.y + box.height / 2;
  // Right to left: the same direction a thumb drags to bring tomorrow into view.
  await page.mouse.move(box.x + box.width * 0.85, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, y, { steps: 5 });
  await page.mouse.up();

  // The sheet is still open, now on the next day — swiping is not a way to close it.
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: new RegExp(`^${formatDayInZone(tuesday!, "EEEE")}`) }),
  ).toBeVisible();

  await choice(page, "Curry").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(day(page, monday!)).toContainText("Pancakes");
  await expect(day(page, tuesday!)).toContainText("Curry");
});
