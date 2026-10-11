import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";
import { nemligStubUrl } from "./helpers/servers";

/**
 * "Send to Nemlig", from connecting the household's login on /settings to the basket
 * being filled, against this worker's stand-in for nemlig.com (`nemlig-stub.mjs`). The
 * stub's basket is what is asked afterwards — what the household's Nemlig account would
 * be holding.
 */

const stub = () => nemligStubUrl(Number(process.env.TEST_PARALLEL_INDEX ?? 0));

async function shoppingList() {
  const admin = await prisma().user.findUniqueOrThrow({
    where: { email: ACCOUNTS.admin.email },
    select: { id: true, activeHomeId: true },
  });
  return prisma().list.create({
    data: {
      homeId: admin.activeHomeId!,
      createdById: admin.id,
      title: "Weekly shop",
      trackAmounts: true,
      items: {
        create: [
          { text: "Mælk", amount: 2, position: 1 },
          { text: "Bananer", position: 2 },
          { text: "Drageblod", position: 3 },
          { text: "Kanel", position: 4 },
          { text: "Rugbrød", position: 5, done: true },
        ],
      },
    },
  });
}

test.beforeEach(async () => {
  await fetch(`${stub()}/stub/basket`, { method: "DELETE" });
});

test("a list goes into the household's Nemlig basket after it has been checked", async ({ page, loginAs }) => {
  const list = await shoppingList();
  await loginAs(ACCOUNTS.admin);

  // No login yet: the list offers nothing.
  await page.goto(`/lists/${list.id}`);
  await expect(page.getByRole("heading", { name: "Weekly shop" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to Nemlig" })).toHaveCount(0);

  // A wrong password is said on the spot, and nothing is kept.
  await page.goto("/settings");
  await page.getByLabel("Nemlig email").fill("ada@example.com");
  await page.getByLabel("Nemlig password").fill("wrong-password");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Nemlig did not accept the login.", { exact: false })).toBeVisible();

  await page.getByLabel("Nemlig password").fill("the-right-one");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Connected as ada@example.com")).toBeVisible();

  await page.goto(`/lists/${list.id}`);
  const send = page.getByRole("button", { name: "Send to Nemlig" });
  await expect(send).toHaveAttribute("data-ready", "true");
  await send.click();

  const sheet = page.getByRole("dialog");
  const row = (text: string) => sheet.locator(`[data-nemlig-row="${text}"]`);
  // Every open line, and nothing already ticked off.
  await expect(row("Mælk")).toBeVisible();
  await expect(sheet.locator("[data-nemlig-row]")).toHaveCount(4);
  // "Mælk" is read as milk, not as the chocolate.
  await expect(row("Mælk")).toContainText("Letmælk");
  await expect(row("Drageblod")).toContainText("Nemlig found nothing for this.");

  // Swap the milk for another of the results.
  await row("Mælk").getByRole("button", { name: "Change" }).click();
  await row("Mælk").getByRole("button", { name: /Økologisk sødmælk/ }).click();
  await expect(row("Mælk")).toContainText("Økologisk sødmælk");

  // Skip the bananas.
  await row("Bananer").getByRole("button", { name: "Skip" }).click();
  await expect(row("Bananer")).toContainText("Skipped");

  await sheet.getByRole("button", { name: "Put 2 items in the basket" }).click();

  // The cinnamon is refused by the basket; the milk goes in regardless.
  await expect(sheet.getByText("Added · 1")).toBeVisible();
  await expect(sheet.getByText("Skipped · 2")).toBeVisible();
  await expect(sheet.getByText("Failed · 1")).toBeVisible();
  await expect(sheet).toContainText("Nemlig would not add it.");
  await expect(sheet.getByRole("link", { name: "Open the basket on nemlig.com" })).toHaveAttribute(
    "href",
    "https://www.nemlig.com/basket",
  );

  const basket = await (await fetch(`${stub()}/stub/basket`)).json();
  expect(basket).toEqual([{ ProductId: 5002, Quantity: 2 }]);

  // The milk chosen is the household's usual from now on.
  await sheet.getByRole("button", { name: "Done" }).click();
  await send.click();
  await expect(row("Mælk")).toContainText("Økologisk sødmælk");
  await expect(row("Mælk")).toContainText("Your usual");
});
