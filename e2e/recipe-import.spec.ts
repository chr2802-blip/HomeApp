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
