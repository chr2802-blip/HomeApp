import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { CATEGORIES, HOME_NAME, prisma } from "./helpers/database";

/*
 * Cooking a recipe, on the phone it is actually cooked on.
 *
 * Three things here can only be asked of a real browser. Whether the page turn *ran* —
 * a CSS animation that quietly does nothing looks exactly like one that works, which is
 * `animation.spec.ts`'s whole subject, so the same recorder is used. Whether a swipe
 * turns the page at all, since the gesture is pointer events and a threshold. And
 * whether the surface clears the app's own chrome, which it only does because it is
 * portalled past a transformed ancestor — something no unit test can see.
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

/** A recipe already prepared, as a save would have left it: one entry per step, each
 *  naming the ingredient lines that step uses. */
async function seedPrepared(options: { cookSteps?: unknown; servings?: number } = {}) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });
  const category = await db.recipeCategory.findFirstOrThrow({
    where: { homeId: home.id, name: CATEGORIES[0] },
  });

  return db.recipe.create({
    data: {
      homeId: home.id,
      createdById: owner.id,
      title: "Ovnkartofler",
      servings: options.servings ?? null,
      ingredients: "500 g kartofler\n2 spsk olie\nSalt",
      instructions: "Skær kartoflerne i både.\nVend dem i olien.\nBag dem i ovnen.",
      cookSteps:
        "cookSteps" in options
          ? (options.cookSteps as never)
          : {
              v: 1,
              steps: [
                { uses: [0], minutes: null },
                { uses: [1, 2], minutes: null },
                { uses: [], minutes: 10 },
              ],
            },
      categories: { create: [{ categoryId: category.id }] },
    },
  });
}

/** The surface says when React has it, the way every interactive widget here does: the
 *  markup is identical before and after the listeners are attached. */
async function openCookMode(page: Page, recipeId: string) {
  await page.goto(`/recipes/${recipeId}/cook`);
  const surface = page.getByRole("dialog", { name: /Cooking/ });
  await expect(surface).toHaveAttribute("data-ready", "true");
  return surface;
}

/** A thumb dragged across the page, from one side to the other. */
async function swipe(page: Page, direction: "next" | "back") {
  const box = (await page.getByRole("dialog").boundingBox())!;
  const y = box.y + box.height / 2;
  const [from, to] = direction === "next" ? [0.85, 0.15] : [0.15, 0.85];

  await page.mouse.move(box.x + box.width * from, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to, y, { steps: 5 });
  await page.mouse.up();
}

test.beforeEach(async ({ page, loginAs }) => {
  await page.addInitScript(RECORD);
  await loginAs(ACCOUNTS.member);
  await page.setViewportSize({ width: 390, height: 680 });
});

test("opens on the ingredients and turns a page at a time, with what each step needs", async ({
  page,
}) => {
  const recipe = await seedPrepared();
  const surface = await openCookMode(page, recipe.id);

  // The mise en place: everything on the counter before anything is on the heat.
  await expect(surface.getByRole("heading", { name: "Ovnkartofler" })).toBeVisible();
  await expect(surface.getByText("500 g kartofler")).toBeVisible();
  await expect(surface.getByText("2 spsk olie")).toBeVisible();

  await surface.getByRole("button", { name: "Start" }).click();

  await expect(surface.getByText("Skær kartoflerne i både.")).toBeVisible();
  await expect(surface.getByText("Step 1 of 3")).toBeVisible();

  // Only what this step uses — the oil belongs to the next one.
  await expect(surface.getByText("For this step")).toBeVisible();
  await expect(surface.getByText("500 g kartofler")).toBeVisible();
  await expect(surface.getByText("2 spsk olie")).toHaveCount(0);

  await swipe(page, "next");

  await expect(surface.getByText("Vend dem i olien.")).toBeVisible();
  await expect(surface.getByText("2 spsk olie")).toBeVisible();
  await expect(surface.getByText("Salt")).toBeVisible();

  await swipe(page, "back");

  await expect(surface.getByText("Skær kartoflerne i både.")).toBeVisible();
});

test("cooks the portions the recipe page was showing, and goes back to them", async ({ page }) => {
  const recipe = await seedPrepared({ servings: 4 });
  await page.goto(`/recipes/${recipe.id}`);

  await expect(page.getByText("500 g kartofler")).toBeVisible();

  // The portions are an icon beside the ingredients, and the stepper is in its sheet.
  const portionsButton = page.getByRole("button", { name: "Portions" });
  await expect(portionsButton).toHaveAttribute("data-ready", "true");
  await expect(portionsButton).toHaveText("4");
  await portionsButton.click();
  const sheet = page.getByRole("dialog", { name: "Portions" });
  await expect(sheet.getByTestId("portions")).toHaveText("4 portions");
  await sheet.getByRole("button", { name: "More portions" }).click();
  await sheet.getByRole("button", { name: "More portions" }).click();
  await expect(sheet.getByTestId("portions")).toHaveText("6 portions");
  await expect(sheet.getByText("The recipe is written for 4")).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);

  await expect(portionsButton).toHaveText("6");
  await expect(page.getByText("750 g kartofler")).toBeVisible();
  await expect(page.getByText("3 spsk olie")).toBeVisible();
  // Unmeasured stays unmeasured, however many it is for.
  await expect(page.getByRole("listitem").filter({ hasText: /^·\s*Salt$/ })).toBeVisible();

  await page.getByRole("link", { name: "Start cooking" }).click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}/cook?portions=6`);
  const surface = page.getByRole("dialog", { name: /Cooking/ });
  await expect(surface).toHaveAttribute("data-ready", "true");
  await expect(surface.getByTestId("cook-portions")).toHaveText(/6 portions/);
  await expect(surface.getByText("750 g kartofler")).toBeVisible();

  // A step's own ingredients are scaled the same way.
  await surface.getByRole("button", { name: "Start" }).click();
  await expect(surface.getByText("750 g kartofler")).toBeVisible();

  await surface.getByRole("link", { name: "Close" }).click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}?portions=6`);
  await expect(page.getByRole("button", { name: "Portions" })).toHaveText("6");

  // Nothing was written back: the recipe is still the recipe as written.
  expect((await prisma().recipe.findUniqueOrThrow({ where: { id: recipe.id } })).ingredients).toBe(
    "500 g kartofler\n2 spsk olie\nSalt",
  );
});

test("turns the page like a leaf, and in the direction it was swiped", async ({ page }) => {
  const recipe = await seedPrepared();
  const surface = await openCookMode(page, recipe.id);

  await page.evaluate(() => ((window as Recorder).__animations = []));
  await swipe(page, "next");
  await expect
    .poll(() => page.evaluate(() => (window as Recorder).__animations ?? []))
    .toContain("page-turn-next");

  await expect(surface.getByText("Skær kartoflerne i både.")).toBeVisible();

  await page.evaluate(() => ((window as Recorder).__animations = []));
  await swipe(page, "back");
  await expect
    .poll(() => page.evaluate(() => (window as Recorder).__animations ?? []))
    .toContain("page-turn-back");
});

test("covers the app's own chrome, and gives a way back at the end", async ({ page }) => {
  const recipe = await seedPrepared();
  const surface = await openCookMode(page, recipe.id);

  // The tab bar is underneath it, not beside it — and "underneath" is the assertion
  // worth making, because the way this fails is stacking rather than layout: the app's
  // layout animates its pages with a transform, and a transformed ancestor contains a
  // fixed child. Rendered in place instead of portalled, this surface would still be
  // there, still `fixed inset-0`, and the tab bar would be sitting on top of it. So ask
  // the browser what is actually at that point on the screen.
  const navBox = (await page.getByRole("navigation").boundingBox())!;
  const covered = await page.evaluate(
    ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="dialog"]')),
    { x: navBox.x + navBox.width / 2, y: navBox.y + navBox.height / 2 },
  );
  expect(covered).toBe(true);

  for (const label of ["Start", "Next", "Next", "Complete"]) {
    await surface.getByRole("button", { name: label, exact: true }).click();
  }

  // Completing the last step is a close, not one more page: there is nothing after it
  // to turn to.
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
  await expect(page.getByRole("heading", { name: "Ovnkartofler" })).toBeVisible();
});

test("closes on the first page and completes on the last, both without a Back to fall on", async ({
  page,
}) => {
  const recipe = await seedPrepared();
  let surface = await openCookMode(page, recipe.id);

  // Nothing to turn back to from the mise en place, so the left action closes instead.
  await expect(surface.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  await surface.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);

  surface = await openCookMode(page, recipe.id);
  for (const label of ["Start", "Next", "Next"]) {
    await surface.getByRole("button", { name: label, exact: true }).click();
  }

  // On the last step there is nowhere left to turn to either, so the right action reads
  // Complete rather than Next and closes the mode the same way.
  await expect(surface.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
  await surface.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
});

test("counts a step's own time down while the pages keep turning", async ({ page }) => {
  const recipe = await seedPrepared();
  const surface = await openCookMode(page, recipe.id);

  for (const label of ["Start", "Next", "Next"]) {
    await surface.getByRole("button", { name: label, exact: true }).click();
  }

  await surface.getByRole("button", { name: "Start 10 min" }).click();

  const timer = surface.getByRole("button", { name: /^Step 3 ·/ });
  await expect(timer).toBeVisible();

  // It belongs to the cooking rather than to the step, so turning back does not end it.
  await surface.getByRole("button", { name: "Back", exact: true }).click();
  await expect(surface.getByText("Vend dem i olien.")).toBeVisible();
  await expect(timer).toBeVisible();

  await timer.click();
  await expect(timer).toHaveCount(0);
});

test("cooks a recipe nothing has prepared, and offers to prepare it", async ({ page }) => {
  const recipe = await seedPrepared({ cookSteps: null });
  const surface = await openCookMode(page, recipe.id);

  // The offer, because the steps would otherwise show with nothing under them and no
  // word about why.
  const prepare = surface.getByRole("button", { name: "Prepare these steps" });
  await expect(prepare).toBeVisible();

  await surface.getByRole("button", { name: "Start" }).click();
  await expect(surface.getByText("Skær kartoflerne i både.")).toBeVisible();
  await expect(surface.getByText("For this step")).toHaveCount(0);

  await surface.getByRole("button", { name: "Back", exact: true }).click();
  await prepare.click();

  // The reader is stubbed (see e2e/helpers/anthropic-stub.mjs) and hands the steps back
  // as they were, with one ingredient against each.
  await expect(surface.getByRole("button", { name: "Prepare these steps" })).toHaveCount(0);
  await surface.getByRole("button", { name: "Start" }).click();
  await expect(surface.getByText("For this step")).toBeVisible();
  await expect(surface.getByText("500 g kartofler")).toBeVisible();
});

test("is reached from the recipe, and only where there is something to cook", async ({ page }) => {
  const recipe = await seedPrepared();

  await page.goto(`/recipes/${recipe.id}`);
  await page.getByRole("link", { name: "Start cooking" }).click();

  await expect(page).toHaveURL(`/recipes/${recipe.id}/cook`);
  await expect(page.getByRole("dialog", { name: /Cooking/ })).toBeVisible();
});

test("comes back to the same step and the same timer after the phone threw the page away", async ({
  page,
}) => {
  const recipe = await seedPrepared();
  let surface = await openCookMode(page, recipe.id);

  for (const label of ["Start", "Next", "Next"]) {
    await surface.getByRole("button", { name: label, exact: true }).click();
  }
  await surface.getByRole("button", { name: "Start 10 min" }).click();
  await expect(surface.getByRole("button", { name: /^Step 3 ·/ })).toBeVisible();

  // What an iPhone does to an installed app left in the background: the page is gone, and
  // it is relaunched at the manifest's start_url. A fresh load of the dashboard is that,
  // since nothing in the page gets to run on the way out.
  await page.goto("/dashboard");

  await expect(page).toHaveURL(`/recipes/${recipe.id}/cook`);
  surface = page.getByRole("dialog", { name: /Cooking/ });
  await expect(surface).toHaveAttribute("data-ready", "true");
  await expect(surface.getByText("Step 3 of 3")).toBeVisible();
  // Still counting from when it was started, not restarted: under ten minutes left.
  await expect(surface.getByRole("button", { name: /^Step 3 · (9|10):\d\d/ })).toBeVisible();

  // Leaving on purpose forgets it, so the next launch is just the dashboard.
  await surface.getByRole("link", { name: "Close" }).click();
  await expect(page).toHaveURL(`/recipes/${recipe.id}`);
  await page.goto("/dashboard");
  await expect(page.getByRole("dialog", { name: /Cooking/ })).toHaveCount(0);
  await expect(page).toHaveURL("/dashboard");
});
