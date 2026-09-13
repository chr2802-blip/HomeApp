import { ACCOUNTS, clickAndConfirm, expect, openDialog, test } from "./helpers/fixtures";

test.beforeEach(async ({ loginAs, page }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/recipes/new");
});

async function fillRecipe(
  page: Parameters<typeof openDialog>[0],
  options: { title: string; description?: string; videoUrl?: string; ingredients?: string; instructions?: string },
) {
  await page.getByLabel("Title").fill(options.title);
  if (options.description) await page.getByLabel("Short description").fill(options.description);
  if (options.videoUrl) {
    await page.getByLabel("Video link (Instagram, YouTube, TikTok…)").fill(options.videoUrl);
  }
  if (options.ingredients) await page.getByLabel("Ingredients").fill(options.ingredients);
  if (options.instructions) await page.getByLabel("Instructions").fill(options.instructions);
}

test("a recipe is saved and shown with its ingredients and steps", async ({ page }) => {
  await fillRecipe(page, {
    title: "Pancakes",
    description: "Sunday breakfast",
    ingredients: "200 g flour\n2 eggs\n300 ml milk",
    instructions: "Whisk everything.\nRest the batter.\nFry until golden.",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page).toHaveURL(/\/recipes\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Pancakes" })).toBeVisible();
  await expect(page.getByText("Sunday breakfast")).toBeVisible();
  await expect(page.getByText("200 g flour")).toBeVisible();
  await expect(page.getByText("Rest the batter.")).toBeVisible();
});

test("a YouTube link is embedded as an iframe", async ({ page }) => {
  await fillRecipe(page, {
    title: "Carbonara",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[a-z0-9]+$/);

  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("src", "https://www.youtube.com/embed/dQw4w9WgXcQ");
  await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
});

test("an Instagram reel is embedded", async ({ page }) => {
  await fillRecipe(page, {
    title: "Reel dinner",
    videoUrl: "https://www.instagram.com/reel/AbC123/",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[a-z0-9]+$/);

  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.instagram.com/p/AbC123/embed",
  );
});

test("a link that cannot be embedded falls back to opening in a new tab", async ({ page }) => {
  await fillRecipe(page, {
    title: "Blog recipe",
    videoUrl: "https://example.com/some/recipe",
  });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[a-z0-9]+$/);

  await expect(page.locator("iframe")).toHaveCount(0);
  const link = page.getByRole("link", { name: "Open the linked video" });
  await expect(link).toHaveAttribute("href", "https://example.com/some/recipe");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("a recipe can be edited from its page", async ({ page }) => {
  await fillRecipe(page, { title: "Rough draft", ingredients: "Flour" });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[a-z0-9]+$/);

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
  await page.waitForURL(/\/recipes\/[a-z0-9]+$/);

  await clickAndConfirm(page, "Delete");

  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByText("Doomed recipe")).toBeHidden();
});

test("a recipe with no written steps says to follow the video", async ({ page }) => {
  await fillRecipe(page, { title: "Video only", videoUrl: "https://youtu.be/dQw4w9WgXcQ" });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[a-z0-9]+$/);

  await expect(page.getByText("None written — follow the video.")).toBeVisible();
  await expect(page.getByText("None listed.")).toBeVisible();
});
