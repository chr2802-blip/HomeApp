import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";

/*
 * Movement that silently is not movement.
 *
 * Every animation in the app is CSS, which fails quietly: a transition naming a property
 * that nothing changes, or one whose starting state was never painted, leaves the thing
 * arriving instantly with nothing in the markup to say so. Both had happened — the
 * sheets and the tab pill eased `transform`, which is not what Tailwind writes for
 * `scale-*` or `translate-*`, and the sheet was mounted and opened inside one frame.
 *
 * So these ask the browser what actually ran rather than what the classes say. Each
 * animation is recorded as it starts by a listener installed ahead of the page's own
 * scripts, and the assertions wait for the recording rather than for a moment when the
 * movement happens to be in progress: an animation event is dispatched at the end of the
 * frame, which is after the element it belongs to is on screen and clickable.
 */

const RECORD = `
  window.__animations = [];
  document.addEventListener(
    "animationstart",
    (event) => window.__animations.push(event.animationName),
    true,
  );
`;

type Recorder = Window & { __animations?: string[] };

test.beforeEach(async ({ page, loginAs }) => {
  await page.addInitScript(RECORD);
  await loginAs(ACCOUNTS.member);
});

/** Forgets what has run so far, so the next assertion is about the next movement. */
async function forget(page: Page) {
  await page.evaluate(() => ((window as Recorder).__animations = []));
}

/** Waits until every named animation has been seen. */
async function expectPlayed(page: Page, ...names: string[]) {
  await expect
    .poll(() => page.evaluate(() => (window as Recorder).__animations ?? []))
    .toEqual(expect.arrayContaining(names));
}

/**
 * Waits until the most recent page arrival is the one expected. The newest rather than
 * any of them: the arrival before it may still be being recorded when the next
 * navigation is asked for, and which one is last is the question being asked.
 */
async function expectArrival(page: Page, name: string) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          ((window as Recorder).__animations ?? [])
            .filter((played) => played.startsWith("page-"))
            .at(-1) ?? null,
      ),
    )
    .toBe(name);
}

test.describe("a sheet", () => {
  test("slides up from the bottom edge on a phone, over a backdrop that fades in", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 680 });
    await page.goto("/recipes");
    await forget(page);

    await openDialog(page, "New recipe");

    await expectPlayed(page, "sheet-in", "backdrop-in");
  });

  test("scales in where it is a panel over the page rather than the page itself", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/recipes");
    await forget(page);

    await openDialog(page, "New recipe");

    await expectPlayed(page, "panel-in", "backdrop-in");
  });

  test("is seen leaving rather than vanishing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 680 });
    await page.goto("/recipes");
    await openDialog(page, "New recipe");
    await forget(page);

    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // Played on the way out, and only then is the sheet taken off the page.
    await expectPlayed(page, "sheet-out", "backdrop-out");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("a page", () => {
  test("arrives from the direction it was reached from", async ({ page }) => {
    await page.goto("/lists");
    await openDialog(page, "New list");
    await page.getByLabel("List name").fill("Weekly shop");
    await page.getByRole("button", { name: "Create list" }).click();
    await page.waitForURL(/\/lists\/[a-z0-9]+$/);

    // Back out of the list to the page that holds it: a segment shallower.
    await page.getByRole("link", { name: "Lists" }).first().click();
    await page.waitForURL(/\/lists$/);
    await expectArrival(page, "page-back");

    // And into it again: a segment deeper, whichever way it was reached.
    await page.getByRole("link", { name: "Weekly shop" }).click();
    await page.waitForURL(/\/lists\/[a-z0-9]+$/);
    await expectArrival(page, "page-forward");

    // Neither path contains the other, so this is a move between tabs.
    await page.getByRole("link", { name: "Tasks" }).first().click();
    await page.waitForURL(/\/tasks$/);
    await expectArrival(page, "page-switch");
  });
});

test.describe("what eases rather than snapping", () => {
  test("the tab pill grows as it lights up", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 680 });
    await page.goto("/dashboard");

    const pill = page.locator('nav a[aria-label="Tasks"] > span').first();
    // The size it moves between is written as `scale`, so that is the property the
    // transition has to name: easing `transform` would be easing nothing.
    await expect(pill).toHaveCSS("scale", "1");
    expect(await pill.evaluate((node) => getComputedStyle(node).transitionProperty)).toContain(
      "scale",
    );

    await page.locator('nav a[aria-label="Tasks"]').click();
    await expect(pill).toHaveCSS("scale", "1.1");
  });

  test("anything tappable eases its own press", async ({ page }) => {
    await page.goto("/lists");

    // Every `active:scale-*` in the app rides on this one rule.
    const pressable = page.locator(".pressable").first();
    const eased = await pressable.evaluate((node) => getComputedStyle(node).transitionProperty);
    expect(eased).toContain("scale");
  });
});

test.describe("the recipes page", () => {
  /** A recipe filed under the first seeded category, and one under the second. */
  async function seedRecipes() {
    const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
    const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

    for (const [title, categoryName] of [
      ["Pancakes", CATEGORIES[0]],
      ["Carbonara", CATEGORIES[1]],
    ] as const) {
      const category = await prisma().recipeCategory.findFirstOrThrow({
        where: { homeId: home.id, name: categoryName },
      });
      await prisma().recipe.create({
        data: {
          homeId: home.id,
          createdById: owner.id,
          title,
          categories: { create: { categoryId: category.id } },
        },
      });
    }
  }

  /**
   * Presses a filter until it takes, then reports what ran because of it.
   *
   * The same hydration problem as every other client control: the chip is the same
   * markup before and after React attaches to it, so the press is offered again until
   * the chip says it is the one that is on. The recording is cleared inside the retry
   * rather than before it, so what is asserted is what the press that actually worked
   * caused — an earlier press that landed on unhydrated markup caused nothing at all.
   */
  async function pressFilter(page: Page, label: string) {
    const chip = page.getByRole("button", { name: new RegExp(`^${label}, `) });
    await expect(async () => {
      await forget(page);
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
    }).toPass({ timeout: 20_000 });
  }

  test("plays its cards in again when a category filter goes on and comes off", async ({
    page,
  }) => {
    await seedRecipes();
    await page.goto("/recipes");
    await expect(page.getByText("Pancakes")).toBeVisible();

    // Narrowing to one heading: the cards that survive it arrive rather than simply
    // staying where they were while the rest vanished.
    await pressFilter(page, CATEGORIES[0]);
    await expectPlayed(page, "row-in");

    // And widening again, which is the same movement in the other direction.
    await pressFilter(page, "All");
    await expectPlayed(page, "row-in");
  });

  test("shows its recipes two to a row on a phone", async ({ page }) => {
    await seedRecipes();
    await page.setViewportSize({ width: 390, height: 680 });
    await page.goto("/recipes");
    await expect(page.getByText("Pancakes")).toBeVisible();

    const columns = await page
      .locator("section .grid")
      .first()
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(2);
  });
});
