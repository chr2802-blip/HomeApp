import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";
import { formatDayInZone, nextWeekStart, weekStartInZone } from "../src/lib/time";

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

test.describe("swiping between meal-plan days", () => {
  test("slides the content the way the drag went, rather than swapping it silently", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 680 });
    // Next week rather than this one: today might be its own week's last day, with
    // nowhere later in it to swipe on to, and every day of a week that has not arrived
    // yet is open regardless of which weekday today happens to be.
    const monday = nextWeekStart(weekStartInZone());
    await page.goto(`/meals?week=${monday}`);
    await forget(page);

    const row = page.getByRole("button", {
      name: new RegExp(`^${formatDayInZone(monday, "EEEE")}`),
    });
    await expect(row).toHaveAttribute("data-ready", "true");
    await row.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Waited for rather than just cleared: the sheet's own entrance is recorded at the
    // end of a frame, which can land after a plain `forget` here — and then it is the
    // swipe's own animation that gets lost in the noise of the one still arriving.
    await expectPlayed(page, "sheet-in");
    await forget(page);

    const box = (await dialog.boundingBox())!;
    const y = box.y + box.height / 2;
    // Right to left: the same direction a thumb drags to bring tomorrow into view.
    await page.mouse.move(box.x + box.width * 0.85, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.15, y, { steps: 5 });
    await page.mouse.up();

    await expectPlayed(page, "page-forward");
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

test.describe("ticking something off a list", () => {
  /** A list with the items named on it, in the order given, none of them ticked. */
  async function seedList(title: string, texts: string[]) {
    const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
    const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

    const list = await prisma().list.create({
      data: {
        homeId: home.id,
        createdById: owner.id,
        title,
        items: { create: texts.map((text, index) => ({ text, position: index + 1 })) },
      },
    });
    return list.id;
  }

  /**
   * Ticks a row off, and reports what ran because of it.
   *
   * The same hydration problem the recipe filters have: the checkbox is the same markup
   * before and after React attaches to it, so the press is offered again until the row
   * says it is ticked. The recording is cleared inside the retry rather than before it,
   * so what is asserted is what the press that actually worked caused.
   */
  async function tickOff(page: Page, text: string) {
    // The row's own form, and the one button in it. Found by the row rather than by the
    // button's name, because that name is the thing about to change: a locator naming
    // "Mark as done" stops matching the moment the press works, which is exactly when
    // the retry below needs to read the button's state.
    const box = page.locator("form").filter({ hasText: text }).getByRole("button").first();

    await expect(async () => {
      await forget(page);
      await box.click();
      await expect(box).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
    }).toPass({ timeout: 20_000 });
  }

  test("is seen on the row it happened to, and again where the row lands", async ({ page }) => {
    const id = await seedList("Weekend shop", ["Milk", "Bread"]);
    await page.goto(`/lists/${id}`);
    await expect(page.getByText("Milk", { exact: true })).toBeVisible();

    await tickOff(page, "Milk");

    // The box fills and pops where it was pressed, the row slides away, and the
    // "Completed" heading it lands in pops as it arrives.
    await expectPlayed(page, "check-pop", "tick-off");
    await expect(page.getByRole("button", { name: "Completed (1)" })).toBeVisible();
    await expect(page.getByText("Bread", { exact: true })).toBeVisible();
  });

  test("throws confetti for the last one, and only for the last one", async ({ page }) => {
    const id = await seedList("Last errand", ["Stamps", "Milk"]);
    await page.goto(`/lists/${id}`);
    await expect(page.getByText("Stamps", { exact: true })).toBeVisible();

    // One of two: the list is not finished, so this is an ordinary tick.
    await tickOff(page, "Stamps");
    await expectPlayed(page, "tick-off");
    expect(await page.evaluate(() => (window as Recorder).__animations ?? [])).not.toContain(
      "confetti",
    );

    // The one that clears the list.
    await tickOff(page, "Milk");
    await expectPlayed(page, "confetti");
    await expect(page.getByText("Nice — everything here is ticked off.")).toBeVisible();
  });

  test("swells the bar once on the way past halfway", async ({ page }) => {
    const id = await seedList("Big shop", ["Milk", "Bread", "Eggs", "Rice"]);
    await page.goto(`/lists/${id}`);
    await expect(page.getByText("Milk", { exact: true })).toBeVisible();

    // One of four is not halfway, so nothing happens yet.
    await tickOff(page, "Milk");
    await expectPlayed(page, "tick-off");
    expect(await page.evaluate(() => (window as Recorder).__animations ?? [])).not.toContain(
      "halfway",
    );

    // Two of four is, and the bar takes a breath.
    await tickOff(page, "Bread");
    await expectPlayed(page, "halfway");

    // The third crosses nothing — it is already past half, and a bar that pulsed on
    // every press after the middle would be saying nothing by the time it mattered.
    await tickOff(page, "Eggs");
    await expectPlayed(page, "tick-off");
    expect(await page.evaluate(() => (window as Recorder).__animations ?? [])).not.toContain(
      "halfway",
    );
  });

  test("the confetti takes itself off the page again", async ({ page }) => {
    const id = await seedList("One thing", ["Stamps"]);
    await page.goto(`/lists/${id}`);
    await expect(page.getByText("Stamps", { exact: true })).toBeVisible();

    await tickOff(page, "Stamps");
    await expectPlayed(page, "confetti");

    // Nothing is left over the page afterwards: it would be invisible and cover
    // everything, which is the worst way for an overlay to outstay its welcome.
    await expect(page.locator(".animate-confetti")).toHaveCount(0);
  });
});

test.describe("marking a task done", () => {
  test("rises a tick out of the button it was pressed on", async ({ page }) => {
    const home = await prisma().home.findFirstOrThrow({ where: { name: HOME_NAME } });
    const owner = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
    await prisma().task.create({
      data: {
        homeId: home.id,
        createdById: owner.id,
        title: "Water the plants",
        intervalDays: 7,
        nextDueAt: new Date(),
      },
    });

    await page.goto("/tasks");
    // A task has no row to slide away, so the stamp is the whole of the feedback — and
    // it is the half that needs React attached. The card's own menu says when that is.
    await expect(page.getByRole("button", { name: "Actions for Water the plants" })).toHaveAttribute(
      "data-ready",
      "true",
    );
    await forget(page);

    await page.getByRole("button", { name: "Mark done" }).click();

    await expectPlayed(page, "stamp");
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
