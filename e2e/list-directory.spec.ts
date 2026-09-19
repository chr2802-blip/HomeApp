import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/** Puts a known set of lists in the home, newest last in the order given. */
async function seedLists(titles: string[]) {
  const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

  for (const title of titles) {
    await prisma().list.create({ data: { homeId: home.id, createdById: owner.id, title } });
  }
}

/** A list with `total` items, the first `done` of them already ticked off. */
async function seedListWithItems(title: string, done: number, total: number) {
  const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const list = await prisma().list.create({ data: { homeId: home.id, createdById: owner.id, title } });

  for (let index = 0; index < total; index++) {
    await prisma().listItem.create({
      data: { listId: list.id, text: `Item ${index}`, done: index < done },
    });
  }

  return list;
}

const star = (page: Page, title: string) =>
  page.getByRole("button", { name: `Favourite ${title}`, exact: true });

/**
 * Presses a star until it takes, then waits for the write to land.
 *
 * Two separate problems, and only the first is about hydration. The button does nothing
 * until React has hydrated it, and nothing in the markup says when that is — the server
 * renders the same button either way — so keep offering the press until the control
 * reports the state it should now be in.
 *
 * But the star fills optimistically: aria-pressed says "true" the instant it is clicked,
 * before the server has been told anything. A test that navigated away on that signal
 * would be racing the action it had just started, and would sometimes arrive at the
 * dashboard before the row existed. So the persisted row is what is actually waited on.
 */
async function press(page: Page, title: string, expected: "true" | "false") {
  await expect(async () => {
    await star(page, title).click();
    await expect(star(page, title)).toHaveAttribute("aria-pressed", expected, { timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  await expect
    .poll(() => prisma().listFavorite.count({ where: { list: { title } } }))
    .toBe(expected === "true" ? 1 : 0);
}

/** The list names currently shown on the lists page, top to bottom. */
const shownLists = (page: Page) => page.locator("p.font-medium").allInnerTexts();

test.describe("favourites", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.member);
  });

  test("the dashboard shows recent lists, and says how to change that", async ({ page }) => {
    await seedLists(["Shopping", "Jobs"]);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Recent lists" })).toBeVisible();
    await expect(page.getByText("to keep it here instead")).toBeVisible();
  });

  test("starring a list puts it on the dashboard in place of the recent ones", async ({ page }) => {
    await seedLists(["Shopping", "Jobs", "Hardware"]);
    await page.goto("/lists");

    await press(page, "Jobs", "true");
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Favourite lists" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent lists" })).toHaveCount(0);
    await expect(page.getByText("to keep it here instead")).toHaveCount(0);

    // Only the starred one — the other two are no longer offered here.
    const section = page.locator("section").filter({ hasText: "Favourite lists" });
    await expect(section.getByText("Jobs", { exact: true })).toBeVisible();
    await expect(section.getByText("Shopping", { exact: true })).toHaveCount(0);
  });

  test("unstarring puts the recent lists back", async ({ page }) => {
    await seedLists(["Shopping", "Jobs"]);
    await page.goto("/lists");

    await press(page, "Jobs", "true");
    await press(page, "Jobs", "false");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Recent lists" })).toBeVisible();
  });

  test("a list can be starred from its own page", async ({ page }) => {
    await seedLists(["Shopping"]);
    const list = await prisma().list.findFirstOrThrow({ where: { title: "Shopping" } });
    await page.goto(`/lists/${list.id}`);

    await press(page, "Shopping", "true");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Favourite lists" })).toBeVisible();
  });

  test("starred lists sort to the top of the lists page", async ({ page }) => {
    await seedLists(["Oldest", "Middle", "Newest"]);
    await page.goto("/lists");

    expect(await shownLists(page)).toEqual(["Newest", "Middle", "Oldest"]);

    await press(page, "Oldest", "true");
    await page.reload();

    expect(await shownLists(page)).toEqual(["Oldest", "Newest", "Middle"]);
  });

  test("one person's favourites are not another's, in the same home", async ({ page, loginAs }) => {
    await seedLists(["Shopping", "Jobs"]);
    await page.goto("/lists");
    await press(page, "Jobs", "true");

    // The admin shares this home and sees the same lists, but none of them starred.
    // Sign the member out first: /login sends an account that already has a session
    // straight back to the dashboard, so the form would never appear.
    await page.context().clearCookies();
    await loginAs(ACCOUNTS.admin);
    await page.goto("/lists");
    await expect(star(page, "Jobs")).toHaveAttribute("aria-pressed", "false");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Recent lists" })).toBeVisible();
  });
});

test.describe("searching the lists", () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs(ACCOUNTS.member);
    await seedLists(["Weekly shop", "Hardware store", "Jobs around the house", "Christmas"]);
    await page.goto("/lists");
  });

  /** Types into the box, retrying until React has hydrated enough to filter on it. */
  async function search(page: Page, text: string, expected: string[]) {
    await expect(async () => {
      await page.getByLabel("Search lists").fill(text);
      await expect.poll(() => shownLists(page), { timeout: 1000 }).toEqual(expected);
    }).toPass({ timeout: 20_000 });
  }

  test("narrows the lists to what matches", async ({ page }) => {
    expect(await shownLists(page)).toHaveLength(4);

    await search(page, "sho", ["Weekly shop"]);
  });

  test("matches anywhere in the name, whatever the case", async ({ page }) => {
    await search(page, "HOUSE", ["Jobs around the house"]);
  });

  test("says so when nothing matches", async ({ page }) => {
    await search(page, "nonsense", []);

    await expect(page.getByText("No list matches “nonsense”.")).toBeVisible();
  });

  test("clearing the box brings them all back", async ({ page }) => {
    await search(page, "sho", ["Weekly shop"]);
    await search(page, "", ["Christmas", "Jobs around the house", "Hardware store", "Weekly shop"]);
  });

  test("a starred list still sorts first among the matches", async ({ page }) => {
    await press(page, "Hardware store", "true");
    await page.reload();

    await search(page, "o", ["Hardware store", "Jobs around the house", "Weekly shop"]);
  });
});

test.describe("lists with everything ticked off", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.member);
  });

  test("folds a finished list under Done, leaving lists with things left showing", async ({
    page,
  }) => {
    await seedListWithItems("Weekly shop", 0, 2);
    await seedListWithItems("Errands", 1, 1);
    await page.goto("/lists");

    // Errands is newer and would otherwise sort first, but every item on it is done.
    expect(await shownLists(page)).toEqual(["Weekly shop"]);

    const section = page.getByRole("button", { name: "Done (1)" });
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("aria-expanded", "false");

    await section.click();
    expect(await shownLists(page)).toEqual(["Weekly shop", "Errands"]);
  });

  test("a favourited list stays put even once everything on it is ticked off", async ({ page }) => {
    const errands = await seedListWithItems("Errands", 1, 1);
    const owner = await prisma().user.findFirstOrThrow({
      where: { email: ACCOUNTS.member.email },
    });
    await prisma().listFavorite.create({ data: { userId: owner.id, listId: errands.id } });

    await page.goto("/lists");

    expect(await shownLists(page)).toEqual(["Errands"]);
    await expect(page.getByRole("button", { name: /Done/ })).toHaveCount(0);
  });

  test("an empty list is not treated as done", async ({ page }) => {
    await seedLists(["Shopping"]);
    await page.goto("/lists");

    expect(await shownLists(page)).toEqual(["Shopping"]);
    await expect(page.getByRole("button", { name: /Done/ })).toHaveCount(0);
  });
});
