import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";
import type { Page } from "@playwright/test";

/** Enough lists that the page scrolls well past a phone's screen, and the last one at the bottom. */
async function seedManyLists() {
  const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

  // Created oldest first, so "List 01" is the newest and drawn at the top.
  for (let index = 40; index >= 1; index--) {
    const title = `List ${String(index).padStart(2, "0")}`;
    const list = await prisma().list.create({ data: { homeId: home.id, createdById: owner.id, title } });
    // The one opened is long too, so arriving part way down it would stay part way down.
    const items = index === 40 ? 80 : 1;
    for (let item = 0; item < items; item++) {
      await prisma().listItem.create({ data: { listId: list.id, text: `Item ${item}`, position: item } });
    }
  }
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

test.describe("scroll position between pages", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ loginAs }) => {
    await seedManyLists();
    await loginAs(ACCOUNTS.member);
  });

  async function openFromFarDown(page: Page) {
    await page.goto("/lists");
    const card = page.getByRole("link", { name: /List 40/ });
    await card.scrollIntoViewIfNeeded();
    const before = await scrollY(page);
    expect(before).toBeGreaterThan(500);

    await card.click();
    await page.waitForURL(/\/lists\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "List 40" })).toBeVisible();
    return before;
  }

  test("a page opened from far down another starts at the top", async ({ page }) => {
    await openFromFarDown(page);
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test("the browser's back button lands where the page was left", async ({ page }) => {
    const before = await openFromFarDown(page);
    await page.goBack();
    await page.waitForURL(/\/lists$/);
    await expect.poll(() => scrollY(page)).toBe(before);
  });

  test("the header's back arrow lands where the page was left", async ({ page }) => {
    const before = await openFromFarDown(page);
    await page.getByRole("link", { name: "Back" }).click();
    await page.waitForURL(/\/lists$/);
    await expect.poll(() => scrollY(page)).toBe(before);
  });

  test("a tab opened from far down a page starts at the top", async ({ page }) => {
    await page.goto("/lists");
    await page.getByRole("link", { name: /List 40/ }).scrollIntoViewIfNeeded();
    await page.getByRole("navigation").getByRole("link", { name: "Tasks" }).last().click();
    await page.waitForURL(/\/tasks$/);
    await expect.poll(() => scrollY(page)).toBe(0);
  });
});
