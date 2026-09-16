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

  // Nothing should raise a native dialog any more — destructive actions ask through
  // the app's own sheet. Accepting is a safety net so a stray confirm() cannot hang a
  // test; failing loudly instead would be caught by the assertions that follow.
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

/**
 * A control by its name, whether it is a plain button or an entry in a three-dot menu —
 * the same actions live in both places depending on the page.
 */
function control(scope: Page | Locator, name: string) {
  return scope
    .getByRole("button", { name, exact: true })
    .or(scope.getByRole("menuitem", { name, exact: true }));
}

/** Opens a FormDialog by its trigger and waits for the modal to be usable. */
export async function openDialog(page: Page, triggerName: string) {
  await control(page, triggerName).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/**
 * Opens an item's three-dot menu, where its Edit and Delete live. `within` narrows it
 * to one card when a page shows several.
 */
export async function openMenu(page: Page, options: { within?: Locator; label?: string } = {}) {
  const scope = options.within ?? page;
  const name = options.label ? `Actions for ${options.label}` : /^Actions for /;
  const trigger = scope.getByRole("button", { name }).first();
  // Hydration has no signal of its own, so the menu emits one: pressing the button
  // before React has attached to it does nothing, and looks exactly like a miss.
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await expect(page.getByRole("menu").first()).toBeVisible();
}

/**
 * Opens the header's home menu — the home's picture and name, which hold this home's
 * settings, your profile and the way into your other homes.
 */
export async function openHomeMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /— home menu$/ });
  // Hydration has no signal of its own; the trigger grows one when it is ready.
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await expect(page.getByRole("menu", { name: "This home and you" })).toBeVisible();
}

/**
 * Clicks a destructive button and agrees to the sheet it raises. `within` narrows the
 * trigger to one row when a page shows several.
 */
export async function clickAndConfirm(
  page: Page,
  triggerName: string,
  options: { within?: Locator; confirmLabel?: string } = {},
) {
  const scope = options.within ?? page;
  await control(scope, triggerName).first().click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: options.confirmLabel ?? triggerName, exact: true }).click();
  await expect(sheet).toBeHidden();
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
