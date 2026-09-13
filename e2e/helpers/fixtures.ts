import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { ACCOUNTS, disconnect, resetAndSeed } from "./database";

type Account = { email: string; password: string; name: string };

type Fixtures = {
  /** Logs the given account in through the real login form. */
  loginAs: (account: Account) => Promise<void>;
  /** Accepts the browser confirm() that guards every destructive button. */
  acceptConfirms: void;
};

export const test = base.extend<Fixtures>({
  // Runs before each test: a clean database with the standard cast.
  page: async ({ page }, use) => {
    await resetAndSeed();
    await use(page);
  },

  acceptConfirms: [
    async ({ page }, use) => {
      page.on("dialog", (dialog) => dialog.accept());
      await use();
    },
    { auto: true },
  ],

  loginAs: async ({ page }, use) => {
    await use(async (account: Account) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(account.email);
      await page.getByLabel("Password").fill(account.password);
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForURL(/\/(dashboard|admin\/homes)/);
    });
  },
});

test.afterAll(async () => {
  await disconnect();
});

/** Opens a FormDialog by its trigger and waits for the modal to be usable. */
export async function openDialog(page: Page, triggerName: string) {
  await page.getByRole("button", { name: triggerName, exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/**
 * The innermost element holding both some identifying text and a given control — the
 * member or home row. Filtering on the control matters: the text alone also matches the
 * inner wrapper that holds the name and nothing else.
 */
export function rowWith(page: Page, text: string, control: Locator) {
  return page.locator("div").filter({ hasText: text }).filter({ has: control }).last();
}

export { ACCOUNTS, expect };
