import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";
import { pantryKey } from "../src/lib/pantry";

/**
 * Two ways the app answers a question about the shop: a list drawn under the aisles it
 * is walked in, and the recipes the cupboard already covers most of.
 */

async function seed() {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  return { db, home, owner };
}

test.beforeEach(async ({ loginAs }) => {
  await loginAs(ACCOUNTS.member);
});

test("a list grouped by aisle draws its items under the shop's aisles, and one can be moved", async ({
  page,
}) => {
  const { db, home, owner } = await seed();
  const list = await db.list.create({
    data: { homeId: home.id, createdById: owner.id, title: "Groceries", groupByAisle: true },
  });
  let position = 1;
  for (const text of ["Milk", "Bananas", "Frozen peas", "Rye bread"]) {
    await db.listItem.create({ data: { listId: list.id, text, position: position++ } });
  }

  await page.goto(`/lists/${list.id}`);
  const aisle = (name: string) => page.locator(`section[data-aisle="${name}"]`);
  await expect(aisle("PRODUCE").getByText("Bananas")).toBeVisible();
  await expect(aisle("DAIRY").getByText("Milk")).toBeVisible();
  await expect(aisle("FROZEN").getByText("Frozen peas")).toBeVisible();
  // The shop's order, not the order they were typed in.
  expect(await page.locator("section[data-aisle]").evaluateAll((els) => els.map((el) => el.getAttribute("data-aisle")))).toEqual([
    "PRODUCE",
    "BAKERY",
    "DAIRY",
    "FROZEN",
  ]);

  // Moved by hand, and remembered for the home.
  await expect(async () => {
    await page.getByRole("button", { name: "Move Milk to another aisle" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bread & bakery" }).click({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect(aisle("BAKERY").getByText("Milk")).toBeVisible();
  await expect
    .poll(() => db.aisleChoice.findFirst({ where: { homeId: home.id, key: "milk" } }).then((row) => row?.aisle))
    .toBe("BAKERY");
  await page.reload();
  await expect(aisle("BAKERY").getByText("Milk")).toBeVisible();
});

test("a list not grouped by aisle draws no aisles", async ({ page }) => {
  const { db, home, owner } = await seed();
  const list = await db.list.create({ data: { homeId: home.id, createdById: owner.id, title: "Packing" } });
  await db.listItem.create({ data: { listId: list.id, text: "Bananas", position: 1 } });

  await page.goto(`/lists/${list.id}`);
  await expect(page.getByText("Bananas")).toBeVisible();
  await expect(page.locator("section[data-aisle]")).toHaveCount(0);
});

test("the pantry says what it can cook, counting what somebody types in", async ({ page }) => {
  const { db, home, owner } = await seed();
  for (const [title, ingredients] of [
    ["Omelet", "3 eggs\n1 dl milk\n50 g cheese"],
    ["Salmon supper", "600 g salmon\n1 lemon"],
  ]) {
    await db.recipe.create({ data: { homeId: home.id, createdById: owner.id, title, ingredients } });
  }
  for (const name of ["Eggs", "Milk"]) {
    await db.pantryItem.create({ data: { homeId: home.id, name, key: pantryKey(name), quantity: 1 } });
  }

  await page.goto("/pantry");
  const sheet = page.getByRole("dialog", { name: "What can we cook?" });
  await expect(async () => {
    await page.getByRole("button", { name: "What can we cook?" }).click();
    await expect(sheet).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  const results = sheet.locator("[data-pantry-cook] li");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Omelet");
  await expect(results.first()).toContainText("You have 2 of 3 ingredients");
  await expect(results.first()).toContainText("Missing: Cheese");

  await sheet.getByLabel("Anything else in the kitchen?").fill("salmon");
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Remove salmon" })).toBeVisible();
  await expect(results).toHaveCount(2);

  // Nothing typed in is kept.
  expect(await db.pantryItem.count({ where: { homeId: home.id } })).toBe(2);
});
