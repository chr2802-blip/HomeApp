import { ACCOUNTS, clickAndConfirm, expect, openDialog, openMenu, SAVED_RECIPE, test } from "./helpers/fixtures";
import { CATEGORIES } from "./helpers/database";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/recipes/new");
});

async function fillRecipe(
  page: Parameters<typeof openDialog>[0],
  options: {
    title: string;
    categories?: string[];
    description?: string;
    videoUrl?: string;
    ingredients?: string;
    instructions?: string;
    totalTimeMinutes?: number;
    servings?: number;
  },
) {
  await page.getByLabel("Title").fill(options.title);
  // Asked on every save, so every recipe typed in here says how many it is for.
  await page.getByLabel("Portions").fill(String(options.servings ?? 4));
  // Every recipe needs at least one category, so the seed's first one stands in unless
  // a test cares which. The box itself is off screen — what a person presses is the
  // chip beside it — so it is ticked rather than clicked at.
  for (const name of options.categories ?? [CATEGORIES[0]]) {
    await page.getByRole("checkbox", { name, exact: true }).check({ force: true });
  }
  if (options.description) await page.getByLabel("Short description").fill(options.description);
  if (options.videoUrl) {
    await page.getByLabel("Video link (Instagram, YouTube, TikTok…)").fill(options.videoUrl);
  }
  if (options.ingredients) await page.getByLabel("Ingredients").fill(options.ingredients);
  if (options.instructions) await page.getByLabel("Instructions").fill(options.instructions);
  if (options.totalTimeMinutes !== undefined) {
    await page.getByLabel("Total time (minutes)").fill(String(options.totalTimeMinutes));
  }
}

test("a recipe is saved and shown with its ingredients and steps", async ({ page }) => {
  await fillRecipe(page, {
    title: "Pancakes",
    description: "Sunday breakfast",
    ingredients: "200 g flour\n2 eggs\n300 ml milk",
    instructions: "Whisk everything.\nRest the batter.\nFry until golden.",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page).toHaveURL(SAVED_RECIPE);
  await expect(page.getByRole("heading", { name: "Pancakes" })).toBeVisible();
  await expect(page.getByText("Sunday breakfast")).toBeVisible();
  await expect(page.getByText("200 g flour")).toBeVisible();
  await expect(page.getByText("Rest the batter.")).toBeVisible();
});

test("a recipe's video link opens in a new tab from a Go to link button, never embedded", async ({
  page,
}) => {
  await fillRecipe(page, {
    title: "Carbonara",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await expect(page.locator("iframe")).toHaveCount(0);
  const link = page.getByRole("link", { name: "Go to link" });
  await expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("a recipe with no video link has no Go to link button", async ({ page }) => {
  await fillRecipe(page, { title: "No video", ingredients: "Flour" });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await expect(page.getByRole("link", { name: "Go to link" })).toHaveCount(0);
});

test("a recipe with both steps and a video link offers Start cooking and Go to link together", async ({
  page,
}) => {
  await fillRecipe(page, {
    title: "Both",
    instructions: "Do it.",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await expect(page.getByRole("link", { name: "Start cooking" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to link" })).toBeVisible();
});

test("a recipe can be edited from its page", async ({ page }) => {
  await fillRecipe(page, { title: "Rough draft", ingredients: "Flour" });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await openMenu(page);
  await openDialog(page, "Edit");
  await page.getByLabel("Title").fill("Polished recipe");
  await page.getByLabel("Ingredients").fill("Flour\nSalt");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Polished recipe" })).toBeVisible();
  await expect(page.getByText("Salt")).toBeVisible();
});

test("a recipe can be deleted", async ({ page }) => {
  await fillRecipe(page, { title: "Doomed recipe" });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await openMenu(page);
  await clickAndConfirm(page, "Delete");

  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByText("Doomed recipe")).toBeHidden();
});

test("a recipe can be filed under several categories at once", async ({ page }) => {
  await fillRecipe(page, { title: "Lasagne", categories: [...CATEGORIES] });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  // Both headings are named on the recipe itself…
  for (const name of CATEGORIES) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }

  // …and both are still ticked when it is opened for editing, so saving again does not
  // quietly drop one of them.
  await openMenu(page);
  await openDialog(page, "Edit");
  for (const name of CATEGORIES) {
    await expect(page.getByRole("checkbox", { name, exact: true })).toBeChecked();
  }
});

test("a recipe cannot be saved with no category at all", async ({ page }) => {
  await fillRecipe(page, { title: "Homeless" });
  await page.getByRole("checkbox", { name: CATEGORIES[0], exact: true }).uncheck({ force: true });
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page.getByText("Choose at least one category for this recipe.")).toBeVisible();
  await expect(page).toHaveURL(/\/recipes\/new$/);
});

test("a recipe's total time is saved and shown on its page", async ({ page }) => {
  await fillRecipe(page, { title: "Quick soup", ingredients: "Stock", totalTimeMinutes: 25 });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await expect(page.getByText("25 min", { exact: true })).toBeVisible();
});

test("a recipe with no written steps says to follow the video, and offers a way to it", async ({
  page,
}) => {
  await fillRecipe(page, { title: "Video only", videoUrl: "https://youtu.be/dQw4w9WgXcQ" });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  await expect(page.getByText("None written — follow the video.")).toBeVisible();
  await expect(page.getByText("None listed.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start cooking" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Go to link" })).toBeVisible();
});

/*
 * The header is `flex items-start justify-between`, with the title's own block (its
 * category badges, its heading, its description) as one flex item beside the menu
 * button as the other. Without `min-w-0` on that first item, a long, unbroken enough
 * title cannot shrink to wrap within its own column — so the row itself wraps instead,
 * carrying the button down onto a line of its own. `min-w-0` is what lets the title
 * wrap in place and the button stay exactly where `items-start` already puts it: level
 * with the top of the header, beside the category badges.
 */
test("a long title wraps in place rather than pushing the menu button onto its own line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await fillRecipe(page, {
    title:
      "A genuinely long recipe title, the kind a household types in without ever thinking about how narrow a phone screen is",
    ingredients: "Flour",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(SAVED_RECIPE);

  const badge = page.getByText(CATEGORIES[0], { exact: true });
  const menuButton = page.getByRole("button", { name: /^Actions for /});
  await expect(badge).toBeVisible();
  await expect(menuButton).toBeVisible();

  const badgeBox = await badge.boundingBox();
  const menuBox = await menuButton.boundingBox();
  expect(badgeBox).not.toBeNull();
  expect(menuBox).not.toBeNull();

  // Both are `items-start` children of the same row, so their tops sit close together
  // when the title has wrapped in place — and a full line height or more apart if the
  // button was pushed onto its own row underneath instead.
  expect(Math.abs(menuBox!.y - badgeBox!.y)).toBeLessThan(30);
});

test.describe("the recipe list's time filter", () => {
  test("narrows the list to recipes under or over 30 minutes", async ({ page }) => {
    await fillRecipe(page, { title: "Quick soup", ingredients: "Stock", totalTimeMinutes: 20 });
    await page.getByRole("button", { name: "Save recipe" }).click();
    await page.waitForURL(SAVED_RECIPE);

    await page.goto("/recipes/new");
    await fillRecipe(page, { title: "Sunday roast", ingredients: "Chicken", totalTimeMinutes: 90 });
    await page.getByRole("button", { name: "Save recipe" }).click();
    await page.waitForURL(SAVED_RECIPE);

    await page.goto("/recipes");
    await expect(page.getByText("Quick soup")).toBeVisible();
    await expect(page.getByText("Sunday roast")).toBeVisible();

    await page.getByRole("button", { name: "Under 30 min, 1 recipe" }).click();
    await expect(page.getByText("Quick soup")).toBeVisible();
    await expect(page.getByText("Sunday roast")).toBeHidden();

    await page.getByRole("button", { name: "30 min+, 1 recipe" }).click();
    await expect(page.getByText("Sunday roast")).toBeVisible();
    await expect(page.getByText("Quick soup")).toBeHidden();

    await page.getByRole("button", { name: "Any time, 2 recipes" }).click();
    await expect(page.getByText("Quick soup")).toBeVisible();
    await expect(page.getByText("Sunday roast")).toBeVisible();
  });

  test("is not offered when nothing in the home has a time on it", async ({ page }) => {
    await fillRecipe(page, { title: "Undated dish", ingredients: "Something" });
    await page.getByRole("button", { name: "Save recipe" }).click();
    await page.waitForURL(SAVED_RECIPE);

    await page.goto("/recipes");
    await expect(page.getByRole("group", { name: "Filter by time" })).toHaveCount(0);
  });
});

test("every rating counts, the same person's too, and the card shows the average beside the time", async ({
  page,
}) => {
  await fillRecipe(page, { title: "Lasagne", ingredients: "Pasta", totalTimeMinutes: 90 });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page).toHaveURL(SAVED_RECIPE);

  // The hearts are in a sheet behind the heart beside the ingredients.
  const ratingButton = page.getByRole("button", { name: "Rating" });
  await expect(ratingButton).toHaveAttribute("data-ready", "true");
  await ratingButton.click();
  await expect(page.getByText("Not rated yet")).toBeVisible();

  await page.getByRole("button", { name: "Give 5 hearts" }).click();
  await expect(page.getByTestId("rating-average")).toHaveText("5");
  await expect(page.getByText("Your last rating: 5 hearts")).toBeVisible();

  // Rating again adds a second rating rather than replacing the first.
  await page.getByRole("button", { name: "Give 2 hearts" }).click();
  await expect(page.getByTestId("rating-average")).toHaveText("3.5");
  await expect(page.getByText("from 2 ratings")).toBeVisible();
  // What is on screen is the optimistic press; the hearts are held until the rating has
  // actually been written, and a reload before then throws the second rating away.
  await expect(page.getByRole("button", { name: "Give 2 hearts" })).toBeEnabled();

  // Still true once the page is drawn from the database rather than the press.
  await page.reload();
  await expect(ratingButton).toHaveText("3.5");
  await expect(ratingButton).toHaveAttribute("data-ready", "true");
  await ratingButton.click();
  await expect(page.getByTestId("rating-average")).toHaveText("3.5");
  await expect(page.getByText("Your last rating: 2 hearts")).toBeVisible();

  await page.goto("/recipes");
  const card = page.getByRole("link", { name: /Lasagne/ });
  await expect(card.getByText("1 hr 30 min")).toBeVisible();
  await expect(card.getByLabel("Rated 3.5 out of 5 from 2 ratings")).toBeVisible();
});
