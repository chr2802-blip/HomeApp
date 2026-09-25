import type { Browser, Page } from "@playwright/test";
import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";
import { sessionCookie } from "./helpers/session";

/**
 * Two people in one shop, each with the same list open on their own phone. A tick on one
 * has to reach the other without anybody reloading — that is the whole of what this
 * holds. The second phone is a second browser context with its own session, so nothing
 * is shared between the two but the server.
 */

async function secondPhone(browser: Browser, baseURL: string, email: string) {
  const { id } = await prisma().user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const context = await browser.newContext({ baseURL });
  await context.addCookies([await sessionCookie(id, baseURL)]);
  return context.newPage();
}

async function sharedList() {
  const member = await prisma().user.findUniqueOrThrow({
    where: { email: ACCOUNTS.member.email },
    select: { id: true, activeHomeId: true },
  });
  return prisma().list.create({
    data: {
      homeId: member.activeHomeId!,
      createdById: member.id,
      title: "Shared shop",
      items: {
        create: [
          { text: "Milk", position: 1 },
          { text: "Bread", position: 2 },
        ],
      },
    },
  });
}

const tickBox = (page: Page, text: string) =>
  page.locator("div").filter({ hasText: new RegExp(`^${text}`) }).last().getByRole("button", {
    name: "Mark as done",
  });

test("a tick on one phone reaches the other without a reload", async ({
  page,
  loginAs,
  browser,
  baseURL,
}) => {
  const list = await sharedList();
  await loginAs(ACCOUNTS.member);
  await page.goto(`/lists/${list.id}`);
  await expect(page.getByText("Milk", { exact: true })).toBeVisible();

  const other = await secondPhone(browser, baseURL!, ACCOUNTS.admin.email);
  try {
    await other.goto(`/lists/${list.id}`);
    await tickBox(other, "Milk").click();
    await expect(other.getByRole("button", { name: "Completed (1)" })).toBeVisible();

    // The first phone was never touched: it finds out by asking.
    await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();
    await expect(page.getByText("Milk", { exact: true })).toBeHidden();
    await expect(page.getByText("Bread", { exact: true })).toBeVisible();

    // And the other way round, for an item somebody adds.
    await page.getByPlaceholder("Add an item").fill("Eggs");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(other.getByText("Eggs", { exact: true })).toBeVisible();
  } finally {
    await other.context().close();
  }
});
