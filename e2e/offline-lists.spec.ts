import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/**
 * What a phone in a supermarket actually does, driven by a browser that is really offline.
 *
 * Nothing here is mocked: `setOffline` makes every request from the page and from its
 * service worker fail, which is the only way to tell a page that survives losing its
 * connection from one that merely looks as though it would.
 */

async function seedList(title: string, texts: string[]) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

  const list = await db.list.create({
    data: { homeId: home.id, createdById: owner.id, title, trackAmounts: true },
  });
  await db.listItem.createMany({
    data: texts.map((text, index) => ({ listId: list.id, text, position: index + 1 })),
  });
  return list;
}

const storedItem = (listId: string, text: string) =>
  prisma().listItem.findFirst({ where: { listId, text } });

/**
 * Opens the list with the service worker in charge of the page.
 *
 * It is registered by the first load and takes over from the next one, and only the loads
 * it is in charge of are kept — so a test that went offline after one load would be
 * testing a browser error page.
 */
async function openWithWorker(page: Page, listId: string) {
  await page.goto(`/lists/${listId}`);
  await page.evaluate(() => navigator.serviceWorker.ready);

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

function row(page: Page, text: string) {
  return page
    .locator("div")
    .filter({ hasText: new RegExp(`^${text}`) })
    .last();
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("a tick made with no connection survives a reload and is sent when it is back", async ({
  page,
  context,
}) => {
  const list = await seedList("Weekend shop", ["Milk", "Bread"]);
  await openWithWorker(page, list.id);

  await context.setOffline(true);
  await row(page, "Milk").getByRole("button", { name: "Mark as done" }).click();

  // Said out loud: a household that is not told cannot tell this apart from a list that
  // lost their shopping.
  await expect(page.getByText(/^Offline/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();
  // Nothing has reached the server, which is the point of the next reload.
  expect((await storedItem(list.id, "Milk"))!.done).toBe(false);

  // The page comes back from the worker's copy, and the tick from this phone's own queue.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Weekend shop" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();
  await expect(page.getByText(/^Offline/)).toBeVisible();

  await context.setOffline(false);

  // Sent the moment there is somebody to send it to, with nothing pressed.
  await expect.poll(async () => (await storedItem(list.id, "Milk"))!.done).toBe(true);
  await expect(page.getByText(/^Offline/)).toBeHidden();
  await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();
});

test("an item added with no connection is on the list, and is created once", async ({
  page,
  context,
}) => {
  const list = await seedList("Weekend shop", ["Milk"]);
  await openWithWorker(page, list.id);

  await context.setOffline(true);
  await page.getByPlaceholder("Add an item").fill("Bin bags");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText("Bin bags", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Offline/)).toBeVisible();

  // Still there after the page has been thrown away and rebuilt from what was kept.
  await page.reload();
  await expect(page.getByText("Bin bags", { exact: true })).toBeVisible();

  await context.setOffline(false);
  await expect.poll(async () => Boolean(await storedItem(list.id, "Bin bags"))).toBe(true);

  // One row, not two: the id was chosen on the phone, so the send cannot add a second.
  await expect
    .poll(() => prisma().listItem.count({ where: { listId: list.id, text: "Bin bags" } }))
    .toBe(1);
  await expect(page.getByText(/^Offline/)).toBeHidden();
});

test("several ticks made in an aisle all arrive", async ({ page, context }) => {
  const list = await seedList("Weekend shop", ["Milk", "Bread", "Eggs"]);
  await openWithWorker(page, list.id);

  await context.setOffline(true);
  for (const text of ["Milk", "Bread", "Eggs"]) {
    await row(page, text).getByRole("button", { name: "Mark as done" }).click();
  }

  await expect(page.getByText("3 changes")).toBeVisible();

  await context.setOffline(false);
  await expect
    .poll(() => prisma().listItem.count({ where: { listId: list.id, done: true } }))
    .toBe(3);

  // The tick that emptied the list is the household's week, whenever it managed to say so.
  await expect.poll(() => prisma().clearedWeek.count()).toBe(1);
});

test("a tick pressed with a connection is not queued at all", async ({ page }) => {
  const list = await seedList("Weekend shop", ["Milk"]);
  await openWithWorker(page, list.id);

  await row(page, "Milk").getByRole("button", { name: "Mark as done" }).click();
  await expect.poll(async () => (await storedItem(list.id, "Milk"))!.done).toBe(true);

  // Nothing to say: the queue is for changes that could not be made, and this one was.
  await expect(page.getByText(/^Offline/)).toHaveCount(0);
  await expect(page.getByText(/to send/)).toHaveCount(0);
});

test("logging out takes this browser's copy of the household with it", async ({ page }) => {
  const list = await seedList("Weekend shop", ["Milk"]);
  await openWithWorker(page, list.id);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login$/);

  // The login page asks the worker to forget the pages it kept: a rendered list carries
  // one person's household in it, and whoever opens this browser next is somebody else.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const names = await caches.keys();
        const pages = names.filter((name) => name.startsWith("homehub-pages"));
        const kept = await Promise.all(pages.map(async (name) => (await caches.open(name)).keys()));
        return kept.flat().length;
      }),
    )
    .toBe(0);
});
