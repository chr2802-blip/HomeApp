import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";

/**
 * A list sorted under headings it keeps for itself: set up from the list's own page, chosen
 * in the add box, and a row moved from one to another.
 */

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("a list with its own categories is set up, filled and sorted from its own page", async ({ page }) => {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const list = await db.list.create({
    data: { homeId: home.id, createdById: owner.id, title: "Cabin", grouping: "OWN" },
  });
  await db.listItem.create({ data: { listId: list.id, text: "Firewood", position: 1 } });

  await page.goto(`/lists/${list.id}`);
  await expect(page.getByText("This list has no categories yet.")).toBeVisible();

  // The list asks for its headings while it has none.
  const sheet = page.getByRole("dialog", { name: "Categories" });
  await expect(async () => {
    await page.getByRole("button", { name: "Set up categories" }).click();
    await expect(sheet).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  for (const name of ["Hardware", "Chemist"]) {
    await sheet.getByLabel("New category").fill(name);
    await sheet.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sheet.getByLabel(`Name of ${name}`)).toBeVisible();
  }
  await sheet.getByRole("button", { name: "Move Chemist up" }).click();
  await expect
    .poll(() =>
      db.listCategory
        .findMany({ where: { listId: list.id }, orderBy: { position: "asc" } })
        .then((rows) => rows.map((row) => row.name)),
    )
    .toEqual(["Chemist", "Hardware"]);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Added straight under a heading from the add box.
  const section = (name: string) => page.locator(`section[data-category="${name}"]`);
  await page.getByRole("radio", { name: "Hardware" }).click();
  await page.getByPlaceholder("Add an item").fill("Screws");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(section("Hardware").getByText("Screws")).toBeVisible();
  await expect(section("UNSORTED").getByText("Firewood")).toBeVisible();
  // The walk order the sheet set, unsorted first.
  expect(
    await page
      .locator("section[data-category]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-category"))),
  ).toEqual(["UNSORTED", "Hardware"]);

  // Moved by hand, and kept.
  await page.getByRole("button", { name: "Move Firewood to another category" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Chemist" }).click();
  await expect(section("Chemist").getByText("Firewood")).toBeVisible();
  await page.reload();
  await expect(section("Chemist").getByText("Firewood")).toBeVisible();
  await expect(section("Hardware").getByText("Screws")).toBeVisible();
});
