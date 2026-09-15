import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

async function recordRun(options: { ok?: boolean; finishedAt?: Date; error?: string } = {}) {
  const finishedAt = options.finishedAt ?? new Date();
  await prisma().cronRun.create({
    data: {
      job: "reminders",
      startedAt: finishedAt,
      finishedAt,
      ok: options.ok ?? true,
      tasksDue: 3,
      notificationsSent: 2,
      error: options.error ?? null,
    },
  });
}

test.describe("the system page", () => {
  test("a super admin sees health, reminders and content counts", async ({ page, loginAs }) => {
    await recordRun();
    await loginAs(ACCOUNTS.superAdmin);

    await page.goto("/admin/system");

    await expect(page.getByRole("heading", { name: "System" })).toBeVisible();
    await expect(page.getByText("Everything looks healthy")).toBeVisible();
    await expect(page.getByText("Reminders are going out as scheduled.")).toBeVisible();
    await expect(page.getByText("3 due · 2 sent")).toBeVisible();
    // Two homes and four people are seeded before every test.
    await expect(page.getByText("Homes", { exact: true })).toBeVisible();
  });

  test("says plainly when reminders have stopped", async ({ page, loginAs }) => {
    await recordRun({ finishedAt: hoursAgo(48) });
    await loginAs(ACCOUNTS.superAdmin);

    await page.goto("/admin/system");

    await expect(page.getByText("Running, but something needs attention")).toBeVisible();
    await expect(page.getByText(/reminders are probably not going out/i)).toBeVisible();
  });

  test("shows the last error when a run failed", async ({ page, loginAs }) => {
    await recordRun({ ok: false, error: "push gateway unreachable" });
    await loginAs(ACCOUNTS.superAdmin);

    await page.goto("/admin/system");

    await expect(page.getByText("Last error: push gateway unreachable")).toBeVisible();
  });

  test("explains itself before the job has ever run", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.superAdmin);

    await page.goto("/admin/system");

    await expect(page.getByText(/The reminder job has not run yet/)).toBeVisible();
  });

  test("is reachable from the admin page", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.superAdmin);
    await prisma().user.update({
      where: { email: ACCOUNTS.superAdmin.email },
      data: { homeId: (await prisma().home.findFirstOrThrow()).id },
    });

    await page.goto("/admin");
    await page.getByRole("link", { name: "System" }).click();

    await expect(page).toHaveURL(/\/admin\/system$/);
  });
});

test.describe("the system page is not for home admins", () => {
  test("a home admin is turned away", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);

    await page.goto("/admin/system");

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a plain member is turned away", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);

    await page.goto("/admin/system");

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a home admin sees no link to it", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);

    await page.goto("/admin");

    await expect(page.getByRole("link", { name: "System" })).toHaveCount(0);
  });
});

test.describe("a home admin's reminder status", () => {
  test("warns when nobody has notifications enabled", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);

    await page.goto("/admin");

    await expect(page.getByText("no one will be notified")).toBeVisible();
    await expect(page.getByText("0 of 2 people have turned reminders on.")).toBeVisible();
    await expect(page.getByText("Last reminder sent:")).toBeVisible();
  });

  test("counts only this home's people, never another home's", async ({ page, loginAs }) => {
    const other = await prisma().home.findFirstOrThrow({ where: { name: "Neighbour House" } });
    const outsider = await prisma().user.findFirstOrThrow({ where: { homeId: other.id } });
    await prisma().pushSubscription.create({
      data: {
        userId: outsider.id,
        endpoint: "https://push.example.test/outsider",
        p256dh: "key",
        auth: "auth",
      },
    });

    await loginAs(ACCOUNTS.admin);
    await page.goto("/admin");

    // The neighbour's subscription must not be counted here.
    await expect(page.getByText("0 of 2 people have turned reminders on.")).toBeVisible();
  });

  test("reports an overdue task in this home", async ({ page, loginAs }) => {
    const home = await prisma().home.findFirstOrThrow({ where: { name: "E2E House" } });
    const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.admin.email } });
    await prisma().task.create({
      data: {
        homeId: home.id,
        createdById: owner.id,
        title: "Overdue chore",
        intervalDays: 7,
        nextDueAt: hoursAgo(72),
      },
    });

    await loginAs(ACCOUNTS.admin);
    await page.goto("/admin");

    await expect(page.getByText("1 task is overdue in this home.")).toBeVisible();
  });
});
