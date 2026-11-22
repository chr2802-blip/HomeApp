import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";

/**
 * Settings' "Done" tab: a press of Done on `/tasks` is credited to whoever pressed it, and
 * the home's admins see who has done how much — the household's members do not.
 */
test("a task marked done is credited to who pressed it, on Settings' Done tab", async ({ page, loginAs }) => {
  const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.admin.email } });
  await prisma().task.create({
    data: { homeId: home.id, createdById: owner.id, title: "Water the plants", intervalDays: 7, nextDueAt: new Date() },
  });

  await loginAs(ACCOUNTS.member);
  await page.goto("/tasks");
  // The row has no three dots of its own; the header's home menu hydrates in the same pass.
  await expect(page.getByRole("button", { name: /— home menu$/ })).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("Due today")).toBeHidden();

  // Somebody who does not run the home is not offered the tally.
  await page.goto("/settings/done");
  await expect(page).toHaveURL(/\/dashboard$/);

  await loginAs(ACCOUNTS.admin);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/done$/);

  const tally = page.locator("section", { has: page.getByRole("heading", { name: "The last 90 days" }) });
  await expect(tally.getByText("1 job done between you.")).toBeVisible();
  await expect(tally.getByRole("listitem").filter({ hasText: ACCOUNTS.member.name })).toContainText("1 job");
  await expect(tally.getByRole("listitem").filter({ hasText: ACCOUNTS.admin.name })).toContainText("0 jobs");

  const recent = page.locator("section", { has: page.getByRole("heading", { name: "Recently done" }) });
  await expect(recent.getByText("Water the plants")).toBeVisible();
  await expect(recent.getByText(ACCOUNTS.member.name, { exact: false })).toBeVisible();
});

test("the Done tab says what it counts before anything has been done", async ({ page, loginAs }) => {
  await loginAs(ACCOUNTS.admin);
  await page.goto("/settings/done");
  await expect(page.getByText("Nothing marked done yet.", { exact: false })).toBeVisible();
});
