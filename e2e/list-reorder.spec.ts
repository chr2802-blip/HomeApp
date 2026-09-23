import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/** Seeds a list and opens it, so each test starts from a known running order. */
async function openList(page: Page, entries: { text: string; done?: boolean }[]) {
  const home = await prisma().home.findFirstOrThrow({ where: { name: "E2E House" } });
  const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const list = await prisma().list.create({
    data: { homeId: home.id, createdById: owner.id, title: "Shopping" },
  });
  await prisma().listItem.createMany({
    data: entries.map((entry, index) => ({
      listId: list.id,
      text: entry.text,
      done: entry.done ?? false,
      position: index + 1,
    })),
  });

  await page.goto(`/lists/${list.id}`);
  return list;
}

/**
 * Drags an item with the keyboard, waiting on dnd-kit's own announcements rather than
 * on the clock.
 *
 * Two things make a naive press-and-hope unreliable. A handle does not respond until
 * React has hydrated it, and nothing in the markup says when that is — dnd-kit renders
 * its attributes and live region on the server too, so dead HTML looks identical. And
 * each step needs the previous one to have been processed. So: keep offering the lift
 * until the live region shows it was taken, then move one step at a time, each waiting
 * for the announcement to change.
 */
async function dragWithKeyboard(
  page: Page,
  handle: string,
  key: "ArrowUp" | "ArrowDown",
  steps = 1,
) {
  const region = page.locator('[id^="DndLiveRegion"]');
  await page.getByRole("button", { name: handle }).focus();

  // Only press while nothing is held, so a retry cannot drop what it just picked up.
  await expect(async () => {
    if ((await region.innerText()).trim() === "") await page.keyboard.press("Space");
    await expect(region).not.toBeEmpty({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  for (let step = 0; step < steps; step++) {
    const before = await region.innerText();
    await page.keyboard.press(key);
    await expect(region).not.toHaveText(before, { timeout: 5_000 });
  }

  await page.keyboard.press("Space");
  await expect(region).toContainText(/dropped/i);
}

/** The visible running order, top to bottom. */
async function shownOrder(page: Page) {
  return page.locator("form span.flex-1").allInnerTexts();
}

const storedOrder = (listId: string) =>
  prisma()
    .listItem.findMany({ where: { listId }, orderBy: [{ done: "asc" }, { position: "asc" }] })
    .then((items) => items.map((item) => item.text));

test.describe("reordering by keyboard", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.member);
  });

  test("moves an item down and remembers it", async ({ page }) => {
    const list = await openList(page, [{ text: "Milk" }, { text: "Bread" }, { text: "Eggs" }]);
    expect(await shownOrder(page)).toEqual(["Milk", "Bread", "Eggs"]);

    await dragWithKeyboard(page, "Reorder Milk", "ArrowDown");

    await expect.poll(() => shownOrder(page)).toEqual(["Bread", "Milk", "Eggs"]);
    await expect.poll(() => storedOrder(list.id)).toEqual(["Bread", "Milk", "Eggs"]);
  });

  test("survives a reload, so the order really was saved", async ({ page }) => {
    const list = await openList(page, [{ text: "Milk" }, { text: "Bread" }, { text: "Eggs" }]);

    await dragWithKeyboard(page, "Reorder Eggs", "ArrowUp", 2);
    await expect.poll(() => storedOrder(list.id)).toEqual(["Eggs", "Milk", "Bread"]);

    await page.reload();

    expect(await shownOrder(page)).toEqual(["Eggs", "Milk", "Bread"]);
  });

  test("ticked items have no handle, so they cannot be dragged into the open list", async ({
    page,
  }) => {
    await openList(page, [{ text: "Milk" }, { text: "Bread", done: true }]);

    // Unfold the completed section, so the absent handle is genuinely absent rather
    // than merely folded away. Keep offering the click until React has hydrated the
    // toggle — nothing in the markup says when that is.
    const section = page.getByRole("button", { name: "Completed (1)" });
    await expect(async () => {
      await section.click();
      await expect(section).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
    }).toPass({ timeout: 20_000 });

    await expect(page.getByText("Bread", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reorder Milk" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reorder Bread" })).toHaveCount(0);
  });
});

test.describe("suggesting what was ticked off", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ACCOUNTS.member);
  });

  test("offers a ticked item as you type, and puts it back when picked", async ({ page }) => {
    const list = await openList(page, [
      { text: "Bread" },
      { text: "Milk", done: true },
      { text: "Mince", done: true },
    ]);

    await page.getByPlaceholder("Add an item").fill("mi");

    const options = page.getByRole("option");
    await expect(options).toHaveCount(2);
    await expect(page.getByRole("listbox")).toContainText("Ticked off earlier");

    await page.getByRole("option", { name: "Milk" }).click();

    // Back on the list, at the end of what is outstanding, and not duplicated.
    await expect.poll(() => storedOrder(list.id)).toEqual(["Bread", "Milk", "Mince"]);
    expect(await prisma().listItem.count({ where: { text: "Milk" } })).toBe(1);
  });

  test("offers nothing when the box is empty", async ({ page }) => {
    await openList(page, [{ text: "Milk", done: true }]);

    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("never suggests something already outstanding", async ({ page }) => {
    await openList(page, [{ text: "Milk" }]);

    await page.getByPlaceholder("Add an item").fill("mil");

    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("can be picked with the keyboard", async ({ page }) => {
    const list = await openList(page, [{ text: "Bread" }, { text: "Milk", done: true }]);

    const box = page.getByPlaceholder("Add an item");
    await box.fill("mi");
    await box.press("ArrowDown");
    await box.press("Enter");

    await expect.poll(() => storedOrder(list.id)).toEqual(["Bread", "Milk"]);
  });

  test("typing the whole name and adding puts it back rather than duplicating", async ({ page }) => {
    const list = await openList(page, [{ text: "Milk", done: true }]);

    await page.getByPlaceholder("Add an item").fill("Milk");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect.poll(() => storedOrder(list.id)).toEqual(["Milk"]);
    expect(await prisma().listItem.count()).toBe(1);
  });

  test("says so when the item is already outstanding", async ({ page }) => {
    await openList(page, [{ text: "Milk" }]);

    await page.getByPlaceholder("Add an item").fill("Milk");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("“Milk” is already on the list.")).toBeVisible();
    expect(await prisma().listItem.count()).toBe(1);
  });

  test("still adds something new", async ({ page }) => {
    await openList(page, [{ text: "Milk", done: true }]);

    await page.getByPlaceholder("Add an item").fill("Butter");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("Butter")).toBeVisible();
    expect(await prisma().listItem.count()).toBe(2);
  });
});
