import type { Page } from "@playwright/test";
import { test, expect, openHomeMenu, openMenu } from "./helpers/fixtures";
import { ACCOUNTS, prisma } from "./helpers/database";
import { tapProblems } from "./helpers/tap-audit";
import { seedDemo } from "../scripts/demo-household";
import { DEMO_PASSWORD, DEMO_PEOPLE } from "../scripts/demo-cast";

/**
 * Everything a person can press answers the press, and is big enough to hit: the demo
 * household (`npm run db:demo` — lists, tasks, a week of dinners, a pantry) opened page by
 * page, and every visible button, link, tab and choice measured as the browser lays it
 * out (`helpers/tap-audit.ts`).
 */
async function audit(page: Page, paths: string[]) {
  const found: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("load");
    // Measured once the page has finished arriving: an arrival scales and slides it.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
    for (const { what, problem } of await tapProblems(page)) found.push(`${path}  ${what}: ${problem}`);
  }
  return [...new Set(found)];
}

/** The same, in a sheet or menu opened on a page: measured once it has finished moving in. */
async function auditOpened(page: Page, path: string, open: () => Promise<unknown>) {
  await page.goto(path);
  await open();
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  return (await tapProblems(page)).map(({ what, problem }) => `${path} (opened)  ${what}: ${problem}`);
}

// A phone, where the app is used and where the tab bar and the "+" are drawn.
test.use({ viewport: { width: 390, height: 844 } });

const alex = { ...DEMO_PEOPLE.alex, password: DEMO_PASSWORD };

test("every button and link on the household's pages presses in and is at least 32 by 32", async ({ page, loginAs }) => {
  test.setTimeout(300_000);
  const { homes } = await seedDemo(prisma());
  const db = prisma();
  const list = await db.list.findFirstOrThrow({ where: { homeId: homes.flat, items: { some: { done: true } } } });
  const grouped = await db.list.findFirstOrThrow({ where: { homeId: homes.flat, grouping: { not: "NONE" } } });
  const recipe = await db.recipe.findFirstOrThrow({ where: { homeId: homes.flat } });
  const task = await db.task.findFirstOrThrow({ where: { homeId: homes.flat } });

  await loginAs(alex);
  // What a press opens: the dashboard's "+", the home menu, a list's three dots.
  // Before the pages: action mode, once opened, is where a fresh load is sent back to
  // (`ResumeCooking`), so the dashboard would not stay put after it.
  const problems = [
    ...(await auditOpened(page, "/dashboard", async () => {
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    })),
    ...(await auditOpened(page, "/dashboard", () => openHomeMenu(page))),
    ...(await auditOpened(page, "/lists", () => openMenu(page))),
  ];
  problems.push(...(await audit(page, [
    "/dashboard",
    "/lists",
    `/lists/${list.id}`,
    `/lists/${grouped.id}`,
    "/tasks",
    `/tasks/${task.id}`,
    "/recipes",
    `/recipes/${recipe.id}`,
    `/recipes/${recipe.id}/edit`,
    `/recipes/${recipe.id}/cook`,
    "/recipes/new",
    "/meals",
    "/pantry",
    "/settings",
    "/settings/members",
    "/settings/categories",
    "/settings/done",
    "/settings/status",
    "/profile",
    "/homes",
  ])));

  expect(problems).toEqual([]);
});

test("the super admin's pages and the pages before signing in press in and are at least 32 by 32", async ({ page, loginAs, context }) => {
  test.setTimeout(120_000);
  await loginAs(ACCOUNTS.superAdmin);
  const signedIn = await audit(page, ["/admin/system", "/admin/homes"]);

  await context.clearCookies();
  const signedOut = await audit(page, ["/login", "/accept-invite"]);
  expect([...signedIn, ...signedOut]).toEqual([]);
});
