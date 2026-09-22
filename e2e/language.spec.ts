import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, openDialog, SAVED_RECIPE, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";

/**
 * A home's own language, through the browser — the seam where server copy, client
 * copy, the frame and a lib module all meet in one pass. This is deliberately the only
 * spec of its kind: a Danish mirror of the whole browser suite would double the
 * slowest thing in this repo and prove nothing the wiring here does not already show.
 * The units, the decimal separator and the plural forms are proved properly, with no
 * server at all, by `tests/unit/recipe-normalize.test.ts` and `tests/unit/copy.test.ts`.
 */

const htmlOf = (page: Page) => page.locator("html");

async function keepIn(page: Page, name: string) {
  await page.getByLabel("Noget I altid har hjemme").fill(name);
  await page.getByRole("button", { name: "Tilføj til spisekammer" }).click();
  await expect(page.getByRole("switch", { name, exact: true })).toBeVisible();
}

test("picks the language the whole household is then spoken to in", async ({ page, loginAs }) => {
  await loginAs(ACCOUNTS.admin);
  await page.goto("/settings");

  // Every home starts in the app's own voice.
  await expect(htmlOf(page)).toHaveAttribute("lang", "en");

  // A marker that only survives if the document is never torn down, so what follows is
  // the language arriving in the page that is already open rather than in a new one —
  // the same proof `theme.spec.ts` makes for the colour.
  await page.evaluate(() => {
    (window as unknown as { __alive?: boolean }).__alive = true;
  });

  await page.getByRole("radio", { name: "Dansk" }).check();
  await page.getByRole("button", { name: "Save home" }).click();

  await expect(htmlOf(page)).toHaveAttribute("lang", "da");
  // The frame, drawn from the same session as the page it surrounds.
  await expect(page.getByRole("link", { name: "Opgaver" })).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { __alive?: boolean }).__alive === true),
    "the page reloaded, so this says nothing about the language changing in place",
  ).toBe(true);

  // Stored, not merely on screen.
  await page.reload();
  await expect(htmlOf(page)).toHaveAttribute("lang", "da");
  await expect(page.getByRole("radio", { name: "Dansk" })).toBeChecked();
});

test("speaks the pantry, the importer's own copy, and the hardest sentence in the app", async ({
  page,
  loginAs,
}) => {
  await prisma().home.updateMany({ where: { name: HOME_NAME }, data: { language: "DA" } });

  await loginAs(ACCOUNTS.member);

  // The server page, reached without going through the header's own menu — that menu's
  // own label is itself translated ("Dette hjem og dig"), which is a fact for a test
  // about the frame rather than one about the pantry.
  await page.goto("/pantry");
  await expect(page.getByRole("heading", { name: "Spisekammer", level: 1 })).toBeVisible();

  await keepIn(page, "Salt");
  await keepIn(page, "Peber");

  // A shopping list to add the recipe to — the lists area is converted, so its own
  // dialog is Danish too.
  await page.goto("/lists");
  await openDialog(page, "Ny liste");
  await page.getByLabel("Listens navn").fill("Indkøb");
  await page.getByLabel("Hold styr på mængder").check();
  await page.getByRole("button", { name: "Opret liste" }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  // The recipe page is also outside PR 1's screens; "Save recipe" here is the
  // standalone page's own untranslated label, not the one this PR gave the new-recipe
  // dialog.
  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill("Suppe");
  await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).check({ force: true });
  await page.getByLabel("Ingredients").fill("Salt\nPeber\n500 g kartofler");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  // `AddToListMenu` is shared by the recipe page and the pantry, and this PR converted
  // it whole — so its label, and the note it comes back with, are both Danish here.
  const trigger = page.getByRole("button", { name: "Tilføj til liste" });
  await expect(trigger).toHaveAttribute("data-ready", "true");
  await trigger.click();
  await page.getByRole("menuitem", { name: /^Indkøb/ }).click();

  // Salt and Peber are each their own line, each fully covered by their own pantry
  // entry, so this is the plain sentence rather than the ambiguous-line dialog — and
  // it is the pantry's own conjunction, "og", not "and" glued on from the side.
  await expect(page.getByText("Salt og Peber står allerede i spisekammeret.")).toBeVisible();

  await page.goto("/lists");
  await page.getByRole("link", { name: /Indkøb/ }).click();
  await page.waitForURL(/\/lists\/[a-z0-9]+$/);

  // What the pantry answered for never reached the list; what it did not, did.
  await expect(page.getByText("Kartofler", { exact: true })).toBeVisible();
  await expect(page.getByText("Salt", { exact: true })).toHaveCount(0);

  // The tasks area is converted too — its own empty state, in Danish, with nothing
  // planned yet for this household.
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Opgaver", level: 1 })).toBeVisible();
  await expect(page.getByText("Ingen opgaver endnu — tilføj den første ovenfor.")).toBeVisible();
});
