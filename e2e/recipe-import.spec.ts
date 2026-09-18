import { ACCOUNTS, expect, SAVED_RECIPE, test } from "./helpers/fixtures";
import { CATEGORIES } from "./helpers/database";

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("offers to import from a link on a new recipe, but not while editing one", async ({ page }) => {
  await page.goto("/recipes/new");
  await expect(page.getByLabel("Import from a link")).toBeVisible();

  await page.getByLabel("Title").fill("Pancakes");
  await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).check({ force: true });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await page.goto(`${page.url()}/edit`);
  await expect(page.getByLabel("Title")).toHaveValue("Pancakes");
  await expect(page.getByLabel("Import from a link")).toHaveCount(0);
});

test("refuses a link that is not a web address, without touching the rest of the form", async ({
  page,
}) => {
  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill("Should stay put");

  await page.getByLabel("Import from a link").fill("not a link");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Should stay put");
});

/*
 * The same message a bad address gets: this app fetches whatever a cook pastes, on its
 * own server rather than in their browser, so an address only reachable from inside
 * that server — the machine itself, its own network — is refused before anything is
 * fetched, the same way a `javascript:` link is.
 */
test("refuses a link that points back at the server's own network", async ({ page }) => {
  await page.goto("/recipes/new");

  await page.getByLabel("Import from a link").fill("http://127.0.0.1/recipe");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("That doesn't look like a web address.")).toBeVisible();
});

test("reports a link it cannot reach, rather than hanging or crashing", async ({ page }) => {
  await page.goto("/recipes/new");

  // .invalid is reserved by RFC 2606 to never resolve, so this fails the same way on
  // every machine without depending on any real site staying up or reachable.
  await page.getByLabel("Import from a link").fill("https://recipes.invalid/sunday-roast");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("Couldn't reach that page. Check the link and try again.")).toBeVisible({
    timeout: 15_000,
  });
});
