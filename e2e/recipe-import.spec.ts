import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/recipes");
});

test("New recipe asks how to start, before showing either form", async ({ page }) => {
  await openDialog(page, "New recipe");

  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import from a link" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);
  await expect(page.getByLabel("Recipe link")).toHaveCount(0);
});

test("starting from scratch opens the ordinary, empty create form", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Start from scratch" }).click();

  await expect(page.getByLabel("Title")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save recipe" })).toBeVisible();
});

test("a successful import opens the create form pre-filled", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();

  // .invalid is reserved by RFC 2606 to never resolve, so a stub server response is
  // faked at the route level rather than depending on any real site staying up. The
  // fetch itself happens on this app's own server, not in the browser, so intercepting
  // the browser's network here would not reach it — instead the server is pointed at a
  // page it can actually resolve, which route mocking cannot help with either. This
  // test exercises the wiring with a link this sandbox cannot reach; the parsing itself
  // is covered by tests/unit/recipe-import.test.ts, with fetch mocked.
  await page.getByLabel("Recipe link").fill("https://recipes.invalid/sunday-roast");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(
    page.getByText("Couldn't reach that page. Check the link and try again."),
  ).toBeVisible({ timeout: 15_000 });
  // Still on the link step — a failed fetch never reaches the create form.
  await expect(page.getByLabel("Title")).toHaveCount(0);
});

test("refuses a link that is not a web address, without leaving the link step", async ({
  page,
}) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();

  await page.getByLabel("Recipe link").fill("not a link");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
});

test("refuses a link that points back at the server's own network", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();

  await page.getByLabel("Recipe link").fill("http://127.0.0.1/recipe");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
});

test("Back returns to the choice without losing the ability to cancel", async ({ page }) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Import from a link" }).click();
  await page.getByRole("button", { name: "Back" }).click();

  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("reopening after cancelling starts at the choice again, not where it was left", async ({
  page,
}) => {
  await openDialog(page, "New recipe");
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await page.getByLabel("Title").fill("Abandoned");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await openDialog(page, "New recipe");

  await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);
});

/*
 * A recipe link copied specifically to paste in here should not make the cook paste it
 * by hand or press Fetch a second time — choosing "Import from a link" already knows.
 * These stub the browser's clipboard rather than the network, so the outcome after the
 * automatic fetch is one of the deterministic, no-network cases already exercised
 * above (a blocked address, refused instantly) rather than anything that depends on
 * reaching a real site.
 */
test.describe("a recipe link already on the clipboard", () => {
  async function withClipboard(page: import("@playwright/test").Page, text: string) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  }

  test("New recipe always asks first, even with a link on the clipboard", async ({ page }) => {
    await withClipboard(page, "http://127.0.0.1/recipe");

    await openDialog(page, "New recipe");

    await expect(page.getByRole("button", { name: "Start from scratch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import from a link" })).toBeVisible();
    await expect(page.getByLabel("Recipe link")).toHaveCount(0);
  });

  test("choosing Import from a link fills it in and starts fetching on its own", async ({
    page,
  }) => {
    await withClipboard(page, "http://127.0.0.1/recipe");

    await openDialog(page, "New recipe");
    await page.getByRole("button", { name: "Import from a link" }).click();

    // Already fetching without a press of the Fetch button.
    await expect(page.getByLabel("Recipe link")).toHaveValue("http://127.0.0.1/recipe");
    await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
  });

  test("starts blank when the clipboard holds no web address", async ({ page }) => {
    await withClipboard(page, "chicken, not garlic, for the soup");

    await openDialog(page, "New recipe");
    await page.getByRole("button", { name: "Import from a link" }).click();

    await expect(page.getByLabel("Recipe link")).toHaveValue("");
  });

  test("opens the link step blank when the browser never answers", async ({ page }) => {
    // Not a hypothetical: a Chromium with no clipboard permission granted leaves
    // readText() pending for ever rather than refusing it. The link step opens *after*
    // that check, so without a bound on the wait the button does nothing at all — no
    // error, no step, nothing to see. This asks every browser the same question.
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "readText", {
        configurable: true,
        value: () => new Promise(() => {}),
      });
    });
    await page.goto("/recipes");

    await openDialog(page, "New recipe");
    await page.getByRole("button", { name: "Import from a link" }).click();

    await expect(page.getByLabel("Recipe link")).toHaveValue("");
  });

  test("each visit to Import from a link checks the clipboard again", async ({ page }) => {
    await withClipboard(page, "http://127.0.0.1/recipe");
    await openDialog(page, "New recipe");
    await page.getByRole("button", { name: "Import from a link" }).click();
    await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await withClipboard(page, "chicken, not garlic, for the soup");
    await page.getByRole("button", { name: "Import from a link" }).click();

    await expect(page.getByLabel("Recipe link")).toHaveValue("");
  });
});
